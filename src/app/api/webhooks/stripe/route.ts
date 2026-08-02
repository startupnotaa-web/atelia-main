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
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId) {
          // You can also retrieve subscription if needed, but for now we set pro plan
          const adminDb = getAdminDb();
          await adminDb.collection('perfis').doc(userId).set({
            plano: 'pro',
            // if we need expiration date, we should probably fetch the subscription, 
            // but for simple logic we can just set pro.
            // Or use invoice.paid for accurate dates.
          }, { merge: true });
          
          console.log(`Usuário ${userId} atualizado para o plano PRO via checkout.`);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        
        // Buscamos a assinatura para pegar os metadados (onde está o userId)
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.userId;

        if (userId) {
          const expirationDate = new Date((subscription as any).current_period_end * 1000);
          
          const adminDb = getAdminDb();
          await adminDb.collection('perfis').doc(userId).set({
            plano: 'pro',
            assinaturaId: subscription.id,
            dataExpiracao: expirationDate.toISOString(),
          }, { merge: true });
          
          console.log(`Usuário ${userId} atualizado para o plano PRO via invoice.`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (userId) {
          const adminDb = getAdminDb();
          await adminDb.collection('perfis').doc(userId).set({
            plano: 'gratis',
            assinaturaId: null,
            dataExpiracao: null,
          }, { merge: true });
          
          console.log(`Usuário ${userId} revertido para o plano GRATIS.`);
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
