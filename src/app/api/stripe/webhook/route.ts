import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAdminDb } from '@/lib/firebase-admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  try {
    const adminDb = getAdminDb();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;

        if (userId) {
          await adminDb.collection('users').doc(userId).set({
            planType: 'pro',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          console.log(`Usuário ${userId} atualizado para o plano PRO via checkout.`);
        } else {
          console.warn('Checkout concluído, mas nenhum userId foi encontrado no metadata/client_reference_id.');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Precisamos buscar o usuário pelo stripeCustomerId
        const snapshot = await adminDb.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await docRef.set({
            planType: 'free',
            stripeSubscriptionId: null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          console.log(`Assinatura cancelada/inadimplente. Usuário ${snapshot.docs[0].id} revertido para o plano FREE.`);
        } else {
          console.warn(`Customer ${customerId} não encontrado no Firestore para reverter plano.`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('Error handling webhook event:', error);
    return new NextResponse('Internal Webhook Error', { status: 500 });
  }
}
