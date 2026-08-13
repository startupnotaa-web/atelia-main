'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { checkPdfLimit, incrementPdfCount } from '@/lib/checkSubscriptionLimits';
import { verifyAuth } from '@/lib/verifyAuth';
import { revalidatePath } from 'next/cache';
import { registrarVenda } from '@/app/actions/sales';
import { roundCents } from '@/lib/pricingEngine';
import type { Orcamento, OrcamentoItem, OrcamentoStatus } from '@/lib/erpTypes';

export interface QuoteClient {
  id: string;
  name: string;
  phone: string;
}

export interface QuoteProduct {
  id: string;
  nome: string;
  precoFinal: number;
  /** Custo de produção (catalogo.custoBase) — segue no item do orçamento até a conversão em pedido. */
  custoBase: number;
}

export async function fetchClientsForQuotes(userId: string): Promise<QuoteClient[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    const snapshot = await db.collection('clientes').where('userId', '==', userId).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.nome || 'Sem Nome',
        phone: data.phone || data.whatsapp || ''
      };
    });
  } catch (error) {
    console.error('Erro ao buscar clientes para orçamentos:', error);
    return [];
  }
}

export async function fetchProductsForQuotes(userId: string): Promise<QuoteProduct[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    const snapshot = await db.collection('catalogo').where('userId', '==', userId).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nome: data.nome || data.name || 'Sem Nome',
        precoFinal: data.precoFinal || data.price || 0,
        custoBase: data.custoBase || data.custo || 0
      };
    });
  } catch (error) {
    console.error('Erro ao buscar produtos para orçamentos:', error);
    return [];
  }
}

export async function registerPdfGeneration(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    // Verifica limite de PDFs
    try {
      await checkPdfLimit(userId);
    } catch (e: any) {
      if (e.message.includes('PLAN_LIMIT_REACHED')) {
        return { success: false, error: 'LIMIT_REACHED_PDF' };
      }
      throw e;
    }

    // Incrementa contador de PDFs se for Free
    await incrementPdfCount(userId);

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao registrar geração de PDF:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// PERSISTÊNCIA DE ORÇAMENTOS (Fase 4 do INTEGRATION_BLUEPRINT.md)
// ============================================================

export interface CriarOrcamentoInput {
  userId: string;
  clienteId?: string;
  clienteNome: string;
  clienteTelefone?: string;
  itens: OrcamentoItem[];
  desconto?: number;
  prazoEntregaDias?: number;
  valorFinal: number;
  custoTotal: number;
  validade?: string;
}

export async function criarOrcamento(input: CriarOrcamentoInput): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== input.userId) throw new Error('Não autorizado');
    if (!input.itens || input.itens.length === 0) throw new Error('O orçamento precisa ter pelo menos um item.');
    if (typeof input.valorFinal !== 'number' || input.valorFinal < 0) throw new Error('Valor final inválido.');

    const db = getAdminDb();
    const agora = new Date().toISOString();
    const docRef = await db.collection('orcamentos').add({
      userId: authUserId,
      clienteId: input.clienteId || null,
      clienteNome: input.clienteNome,
      clienteTelefone: input.clienteTelefone || '',
      itens: input.itens,
      desconto: input.desconto || 0,
      prazoEntregaDias: input.prazoEntregaDias || null,
      valorFinal: input.valorFinal,
      custoTotal: input.custoTotal,
      status: 'enviado' as OrcamentoStatus,
      validade: input.validade || null,
      createdAt: agora,
      updatedAt: agora,
    });

    revalidatePath('/orcamentos');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao salvar orçamento:', error);
    return { success: false, error: 'Falha ao salvar o orçamento.' };
  }
}

export async function fetchOrcamentos(userId: string): Promise<Orcamento[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');

    const db = getAdminDb();
    const snapshot = await db.collection('orcamentos').where('userId', '==', userId).get();
    const orcamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Orcamento[];

    orcamentos.sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
    return orcamentos;
  } catch (error) {
    console.error('Erro ao buscar orçamentos:', error);
    return [];
  }
}

/**
 * `convertido` nunca é um destino válido por aqui — só `converterOrcamentoEmPedido`
 * grava esse status, junto com o pedido que ele gera.
 */
export async function atualizarStatusOrcamento(
  orcamentoId: string,
  novoStatus: Exclude<OrcamentoStatus, 'convertido'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    const db = getAdminDb();
    const ref = db.collection('orcamentos').doc(orcamentoId);
    const snap = await ref.get();

    if (!snap.exists || snap.data()?.userId !== authUserId) {
      return { success: false, error: 'Orçamento não encontrado ou não autorizado.' };
    }
    if (snap.data()?.status === 'convertido') {
      return { success: false, error: 'Este orçamento já foi convertido em pedido.' };
    }

    await ref.update({ status: novoStatus, updatedAt: new Date().toISOString() });
    revalidatePath('/orcamentos');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar status do orçamento:', error);
    return { success: false, error: 'Falha ao atualizar o status.' };
  }
}

/**
 * A ponte Orçamento -> Venda (INTEGRATION_BLUEPRINT.md, Fase 4). Só converte
 * orçamentos com status 'aprovado', e trava o orçamento em 'convertido' logo
 * depois — dentro da mesma chamada — para um clique duplo não virar dois pedidos.
 *
 * O pedido nasce com pagamento 'pendente' e produção 'fila': aprovar um
 * orçamento é abrir uma encomenda nova, não registrar uma venda já paga e
 * entregue (diferente de PDV/WhatsApp/Consignação, que são vendas instantâneas).
 */
export async function converterOrcamentoEmPedido(orcamentoId: string): Promise<{ success: boolean; pedidoId?: string; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    const db = getAdminDb();
    const ref = db.collection('orcamentos').doc(orcamentoId);
    const snap = await ref.get();

    if (!snap.exists || snap.data()?.userId !== authUserId) {
      return { success: false, error: 'Orçamento não encontrado ou não autorizado.' };
    }

    const orcamento = snap.data() as Orcamento;
    if (orcamento.status === 'convertido') {
      return { success: false, error: 'Este orçamento já foi convertido em pedido.' };
    }
    if (orcamento.status !== 'aprovado') {
      return { success: false, error: 'Só é possível converter orçamentos com status "aprovado".' };
    }

    const resultado = await registrarVenda({
      userId: authUserId,
      itens: orcamento.itens.map(item => ({
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        custoUnitario: item.custoUnitario,
        // Sem estoqueId: o orçamento não amarra a um item específico de
        // estoque_pronto/estoque — é uma encomenda sob medida, cuja baixa de
        // estoque (se houver) acontece manualmente quando a peça é produzida.
      })),
      valorTotal: orcamento.valorFinal,
      custoTotal: roundCents(orcamento.custoTotal),
      formaPagamento: 'outro',
      origem: 'orcamento',
      clienteNome: orcamento.clienteNome,
      produtoNome: orcamento.itens.length === 1 ? orcamento.itens[0].nome : `${orcamento.itens.length} itens (orçamento)`,
      statusPagamento: 'pendente',
      statusProducao: 'fila',
      descricaoFinanceira: `Orçamento aprovado - ${orcamento.clienteNome}`,
    });

    if (!resultado.success) {
      return { success: false, error: resultado.error };
    }

    await ref.update({
      status: 'convertido' as OrcamentoStatus,
      pedidoId: resultado.pedidoId,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/orcamentos');
    revalidatePath('/pedidos');
    return { success: true, pedidoId: resultado.pedidoId };
  } catch (error) {
    console.error('Erro ao converter orçamento em pedido:', error);
    return { success: false, error: 'Falha ao converter o orçamento em pedido.' };
  }
}
