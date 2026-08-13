'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/verifyAuth';
import { revalidatePath } from 'next/cache';
import { roundCents } from '@/lib/pricingEngine';
import type { ItemVenda, OrigemVenda, RegistrarVendaPayload, RegistrarVendaResult } from '@/lib/erpTypes';

const CATEGORIA_FINANCEIRA_POR_ORIGEM: Record<OrigemVenda, string> = {
  pdv: 'Venda PDV',
  whatsapp: 'Venda WhatsApp',
  consignacao: 'Venda Consignada',
  calculadora: 'Venda Calculadora',
  orcamento: 'Venda via Orçamento',
};

/**
 * Motor de Vendas — Fluxo Transacional Único (INTEGRATION_BLUEPRINT.md, Fase 3).
 *
 * Todo ponto de entrada de venda (PDV, WhatsApp, Consignação) deve chamar
 * esta função em vez de montar seu próprio writeBatch: ela é a única fonte
 * de verdade de COMO uma venda é gravada, o que impede a próxima geração dos
 * gargalos documentados em §2.2/§2.3 (campos de estoque e status divergentes
 * entre escritores).
 *
 * Passos, todos dentro de uma única transação atômica (tudo ou nada):
 *   A) Baixa de estoque de cada item (`estoque.currentStock` para insumos,
 *      `estoque_pronto.quantidadeDisponivel` para peças prontas).
 *   B) Cria o pedido com o schema canônico (`Pedido` em erpTypes.ts):
 *      statusProducao/statusPagamento, custo e lucro.
 *   C) Se a venda já está paga (`statusPagamento` 'pago', o default), cria a
 *      entrada espelho em `finance_entries` (schema: value/entrada), vinculada
 *      ao pedido via `pedidoId` — essa vinculação é o que permite a Dashboard
 *      e a Evolução ignorá-la ao somar receita "manual", evitando contar a
 *      mesma venda duas vezes (uma pelo pedido pago, outra pela entrada).
 *      Pedidos que nascem 'pendente'/'sinal' (ex: orçamento convertido em
 *      encomenda) NÃO geram entrada financeira agora — não houve dinheiro
 *      ainda, e um `type: 'entrada'` aqui seria simplesmente falso.
 *
 * O motor confia no `valorTotal`/`custoTotal`/`item.custoUnitario` informados
 * pelo chamador — resolver custo (ex: buscar `custoBase` no catálogo quando a
 * prateleira não tem `custoUnitario`) é responsabilidade de quem monta o
 * payload, não do motor. Isso porque transações do Firestore só leem por
 * referência direta (get), nunca por query — o motor não tem como descobrir
 * sozinho "qual documento de estoque_pronto corresponde a este produtoId".
 */
export async function registrarVenda(payload: RegistrarVendaPayload): Promise<RegistrarVendaResult> {
  try {
    if (!payload.userId) {
      return { success: false, error: 'userId é obrigatório.' };
    }
    if (!(payload.valorTotal > 0)) {
      return { success: false, error: 'O valor total da venda precisa ser maior que zero.' };
    }

    // Toda origem client-side precisa provar, via cookie de sessão, que é
    // realmente a dona dos dados. O webhook do WhatsApp é a única exceção:
    // ele já resolveu e autenticou a usuária (telefone -> users/{uid}) usando
    // o Admin SDK antes de chegar aqui — um canal de confiança diferente, sem
    // cookie de sessão de navegador.
    if (payload.origem !== 'whatsapp') {
      const authUserId = await verifyAuth();
      if (authUserId !== payload.userId) {
        return { success: false, error: 'Não autorizado.' };
      }
    }

    const db = getAdminDb();
    const pedidoRef = db.collection('pedidos').doc();
    const statusPagamento = payload.statusPagamento || 'pago';
    const financeRef = statusPagamento === 'pago' ? db.collection('finance_entries').doc() : null;

    const itensComEstoque: ItemVenda[] = payload.itens.filter((item) => !!item.estoqueId);
    const itensProntaEntrega = itensComEstoque.filter((item) => (item.tipoEstoque ?? 'pronta_entrega') === 'pronta_entrega');
    const itensInsumo = itensComEstoque.filter((item) => item.tipoEstoque === 'insumo');

    const lucro = roundCents(payload.valorTotal - payload.custoTotal);
    const nomeDoPedido =
      payload.produtoNome ||
      (payload.itens.length === 1 ? payload.itens[0].nome : `${payload.itens.length} itens`);
    const clienteNome = payload.clienteNome?.trim() || 'Cliente Balcão';

    await db.runTransaction(async (tx) => {
      // 1. LEITURAS — o Firestore exige que todo tx.get() aconteça antes de
      // qualquer escrita na mesma transação. Só os itens de pronta-entrega
      // precisam de leitura prévia, para decidir a flag `esgotado`; insumos
      // usam increment() e não precisam ler o valor atual.
      const prontaEntregaSnaps = await Promise.all(
        itensProntaEntrega.map((item) => tx.get(db.collection('estoque_pronto').doc(item.estoqueId!)))
      );

      // 2A. ESCRITA — baixa de estoque de insumos (matéria-prima).
      itensInsumo.forEach((item) => {
        tx.update(db.collection('estoque').doc(item.estoqueId!), {
          currentStock: FieldValue.increment(-item.quantidade),
        });
      });

      // 2A. ESCRITA — baixa de estoque de peças prontas; zerou -> esgotado.
      itensProntaEntrega.forEach((item, idx) => {
        const snap = prontaEntregaSnaps[idx];
        if (!snap.exists) return;
        const atual = Number(snap.data()?.quantidadeDisponivel) || 0;
        const novaQtd = Math.max(0, atual - item.quantidade);
        tx.update(snap.ref, { quantidadeDisponivel: novaQtd, esgotado: novaQtd === 0 });
      });

      // 2B. ESCRITA — pedido, schema canônico (Pedido em erpTypes.ts).
      tx.set(pedidoRef, {
        userId: payload.userId,
        cliente: clienteNome,
        clienteNome,
        produtoNome: nomeDoPedido,
        valorFinal: payload.valorTotal,
        custo: payload.custoTotal,
        lucro,
        statusPagamento,
        statusProducao: payload.statusProducao || 'entregue',
        formaPagamento: payload.formaPagamento,
        origem: payload.origem,
        items: payload.itens.map((item) => ({
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          custoUnitario: item.custoUnitario || 0,
        })),
        data: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
        ...(payload.metadados || {}),
      });

      // 2C. ESCRITA — Financeiro, só quando a venda já está paga. `pedidoId`
      // marca esta entrada como espelho da receita do pedido acima (não uma
      // receita independente), para a Dashboard/Evolução não somarem a mesma
      // venda duas vezes.
      if (financeRef) {
        tx.set(financeRef, {
          userId: payload.userId,
          type: 'entrada',
          category: CATEGORIA_FINANCEIRA_POR_ORIGEM[payload.origem],
          value: payload.valorTotal,
          description: payload.descricaoFinanceira || `Venda registrada (${payload.origem}) — ${nomeDoPedido}`,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          pedidoId: pedidoRef.id,
        });
      }
    });

    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    revalidatePath('/evolucao');

    return { success: true, pedidoId: pedidoRef.id };
  } catch (error) {
    console.error('[registrarVenda] Erro ao registrar venda — nada foi salvo:', error);
    return { success: false, error: 'Falha ao registrar a venda. Nada foi salvo.' };
  }
}
