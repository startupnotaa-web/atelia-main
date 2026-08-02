import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interval = 'monthly', userId } = body;

    console.log('--- AUDITORIA DE CHECKOUT ---');
    console.log('Variável Mensal cadastrada?:', !!process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY);
    console.log('Variável Anual cadastrada?:', !!process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY);
    console.log('Valor enviado pelo front (interval):', interval);

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const priceId = interval === 'yearly' 
      ? 'price_1Tn4ki0bsAMO5UUJRCkl4IR6' 
      : 'price_1Tn4ki0bsAMO5UUJ5xS94PFz';

    if (!priceId) {
      throw new Error('ID de Preço Inválido');
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('Chave Stripe existe?', !!process.env.STRIPE_SECRET_KEY);
    console.log('Origin Url:', origin);
    console.log('ID do Preço que será enviado ao Stripe:', priceId);

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
      success_url: `${origin}/perfil?success=true`,
      cancel_url: `${origin}/perfil?canceled=true`,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
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
