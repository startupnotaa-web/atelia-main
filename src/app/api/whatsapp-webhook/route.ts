import { NextResponse } from 'next/server';

// Função stub para processamento assíncrono e preparação para a IA
async function processWhatsAppIntent(phone: string, text: string) {
  // Por enquanto apenas executamos um console.log formatado
  // No próximo passo, isso será conectado ao Gemini e ao Firestore
  console.log(`[WhatsApp Webhook] Mensagem recebida de ${phone}: "${text}"`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verificamos se o evento vem do WhatsApp
    if (body.object === 'whatsapp_business_account') {
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      // Ignoramos status de mensagens capturando apenas textos
      if (message && message.type === 'text') {
        const phone = message.from;
        const text = message.text?.body;
        
        if (phone && text) {
          // Processamento pesado/assíncrono não deve bloquear a resposta do webhook
          processWhatsAppIntent(phone, text).catch(console.error);
        }
      }
    }

    // Regra de Ouro (Timeout Prevention): responder quase imediatamente
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar o webhook do WhatsApp:', error);
    // Em caso de falha no parsing, retornamos erro mas evitamos loops na Meta 
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
