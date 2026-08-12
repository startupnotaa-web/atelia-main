import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Função para processamento assíncrono e integração com a IA
async function processWhatsAppIntent(phone: string, text: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não definida');
    }

    // 1 e 2. Configuração do SDK do Gemini e Engenharia de Prompt
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: 'Você é a Conselheira AtelIA. O usuário enviará uma mensagem de texto (ex: "vendi uma bolsa por 150"). Você deve analisar a intenção e OBRIGATORIAMENTE retornar um objeto JSON válido com duas chaves: intent (podendo ser "REGISTER_SALE", "ADD_EXPENSE", "INQUIRY") e replyText (uma resposta humanizada, curta e acolhedora confirmando a ação para ser enviada no WhatsApp).',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent(text);
    const responseText = result.response.text();
    
    const jsonResponse = JSON.parse(responseText);

    // 3. Execução de Ações (O Braço no Firestore)
    switch (jsonResponse.intent) {
      case 'REGISTER_SALE':
        // TODO: Buscar o usuário no Firestore baseado no número de telefone (phone)
        // TODO: Adicionar uma nova entrada na coleção financeEntries com o valor extraído.
        console.log(`[Intent] Preparando para registrar venda do número ${phone}`);
        break;
      case 'ADD_EXPENSE':
        // TODO: Lógica para adicionar despesa
        console.log(`[Intent] Preparando para registrar despesa do número ${phone}`);
        break;
      case 'INQUIRY':
        // TODO: Lógica para dúvidas gerais
        console.log(`[Intent] Respondendo dúvida do número ${phone}`);
        break;
      default:
        console.log(`[Intent] Intenção desconhecida do número ${phone}: ${jsonResponse.intent}`);
    }

    // 4. Resposta para o Cliente (WhatsApp Send API)
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      throw new Error('Variáveis de ambiente do WhatsApp ausentes');
    }

    const replyPayload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: jsonResponse.replyText },
    };

    const replyResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(replyPayload),
    });

    if (!replyResponse.ok) {
      const errorText = await replyResponse.text();
      console.error(`Erro ao enviar mensagem via WhatsApp API: ${errorText}`);
    } else {
      console.log(`Resposta enviada com sucesso para ${phone}`);
    }

  } catch (error) {
    console.error('[WhatsApp Webhook] Erro no processamento assíncrono:', error);
  }
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
