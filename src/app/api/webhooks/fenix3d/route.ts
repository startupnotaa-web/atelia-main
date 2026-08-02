import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. Verificação de Segurança (Bearer Token)
    const authHeader = req.headers.get('authorization');
    const secret = process.env.FENIX3D_WEBHOOK_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    const { userId, cliente, produto, valor, custo, lucro, statusPedido, materiais } = payload;

    // 2. Validação Mínima do Payload
    if (!userId || !produto || valor === undefined) {
      return NextResponse.json({ error: 'Payload incompleto. Falta userId, produto ou valor.' }, { status: 400 });
    }

    const db = getAdminDb();
    const batch = db.batch();
    const dataAtualIso = new Date().toISOString();

    // 3. Gravar o Pedido
    const novaVendaRef = db.collection('pedidos').doc();
    batch.set(novaVendaRef, {
      userId,
      cliente: cliente || 'Cliente Fenix 3D',
      produto,
      valor: Number(valor),
      custo: Number(custo || 0),
      lucro: Number(lucro || 0),
      status: statusPedido === 'finished' ? 'concluido' : 'pendente',
      data: dataAtualIso,
      createdAt: FieldValue.serverTimestamp(),
      origem: 'fenix3d'
    });

    // 4. Gravar Transação Financeira (Se finalizado/pago)
    if (statusPedido === 'finished') {
      const novaTransacaoRef = db.collection('transactions').doc();
      batch.set(novaTransacaoRef, {
        orderId: novaVendaRef.id,
        amount: Number(valor),
        type: 'integral',
        userId,
        createdAt: dataAtualIso,
        origem: 'fenix3d'
      });
    }

    // 5. Baixa Automática de Estoque
    if (Array.isArray(materiais) && materiais.length > 0) {
      materiais.forEach((mat) => {
        if (mat.estoqueId && mat.quantidade > 0) {
          const estoqueRef = db.collection('estoque').doc(mat.estoqueId);
          batch.update(estoqueRef, {
            quantidade: FieldValue.increment(-Number(mat.quantidade))
          });
        }
      });
    }

    // 6. Efetuar Commit no Banco de Dados
    await batch.commit();

    return NextResponse.json({ success: true, message: 'Pedido processado e baixas efetuadas', orderId: novaVendaRef.id });

  } catch (error: any) {
    console.error('Erro no Webhook Fenix3D:', error);
    return NextResponse.json({ error: 'Erro interno no processamento', details: error.message }, { status: 500 });
  }
}
