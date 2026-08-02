import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Certifique-se de adicionar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET no seu .env
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
    apiVersion: '2026-06-24.dahlia',
  });
  
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'dummy_secret';
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
      // Valida a assinatura do webhook usando a secret do painel do Stripe
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error(`Falha na verificação de assinatura do Webhook: ${err.message}`);
      // Retorna 400 em caso de falha de assinatura
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Tratamento dos eventos
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // O userId deve ser passado via metadata ou client_reference_id durante a criação do checkout
      const userId = session.metadata?.userId || session.client_reference_id;

      if (userId) {
        // Usa o SDK Admin do Firebase (servidor) para atualizar o usuário
        const db = getAdminDb();
        
        await db.collection('users').doc(userId).update({
          plan: 'pro',
          stripeCustomerId: session.customer,
          updatedAt: new Date()
        });
        
        console.log(`✅ Provisionamento concluído para usuário: ${userId}`);
      } else {
        console.warn('⚠️ Webhook Checkout recebido, mas nenhum userId foi encontrado (metadata ou client_reference_id).');
      }
    } else if (event.type === 'invoice.payment_succeeded') {
      // Trata renovações para manter o plano ativo
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      
      if (customerId) {
         const db = getAdminDb();
         const usersRef = db.collection('users');
         const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
         
         if (!snapshot.empty) {
           const userDoc = snapshot.docs[0];
           await userDoc.ref.update({
             plan: 'pro', 
             updatedAt: new Date()
           });
           console.log(`✅ Renovação concluída para cliente Stripe: ${customerId}`);
         }
      }
    }

    // Retorna 200 rápido para confirmar recebimento ao Stripe
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Erro no processamento do Webhook do Stripe:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
