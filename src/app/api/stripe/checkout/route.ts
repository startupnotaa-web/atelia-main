import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getPlanCycle, STRIPE_PRICE_IDS, type BillingInterval } from '@/config/plans';

// Aliases aceitos por compatibilidade com chamadas antigas do frontend.
const INTERVAL_ALIASES: Record<string, BillingInterval> = {
  annual: 'yearly',
  semestral: 'semiannual',
  trimestral: 'quarterly',
  mensal: 'monthly',
  anual: 'yearly',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interval = 'monthly', userId, email } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const normalizedInterval = (INTERVAL_ALIASES[interval] || interval) as BillingInterval;
    const cycle = getPlanCycle(normalizedInterval);

    if (!cycle) {
      return NextResponse.json({ error: `Ciclo de cobrança inválido: ${interval}` }, { status: 400 });
    }

    const priceId = STRIPE_PRICE_IDS[normalizedInterval];

    if (!priceId) {
      console.error(`Price ID não configurado para o ciclo "${normalizedInterval}". Defina a variável de ambiente correspondente.`);
      return NextResponse.json(
        { error: 'Este ciclo de cobrança ainda não está disponível. Tente novamente em instantes.' },
        { status: 500 }
      );
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      customer_email: email || undefined,
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/dashboard?canceled=true`,
      allow_promotion_codes: true,
      metadata: {
        userId,
        billingInterval: normalizedInterval,
      },
      subscription_data: {
        metadata: {
          userId,
          billingInterval: normalizedInterval,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
