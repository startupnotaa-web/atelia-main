import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is missing.');
    return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error(`Webhook Error: ${error.message}`);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  const session = event.data.object as any;

  if (event.type === 'checkout.session.completed') {
    const userId = session.metadata?.userId;
    
    if (userId) {
      try {
        await updateDoc(doc(db, 'perfis', userId), {
          plano: 'pro',
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          updatedAt: new Date().toISOString(),
        });
        console.log(`Sucesso: Usuário ${userId} atualizado para o plano PRO!`);
      } catch (err) {
        console.error('Erro ao atualizar perfil no Firestore:', err);
      }
    } else {
      console.warn('Checkout concluído, mas nenhum userId foi encontrado no metadata.');
    }
  }

  return NextResponse.json({ received: true });
}
