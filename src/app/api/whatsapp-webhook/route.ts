import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAdminDb } from '@/lib/firebase-admin';

// Função para processamento assíncrono e integração com a IA
async function processWhatsAppIntent(phone: string, text: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não definida');
    }

    // 1 e 2. Configuração do SDK do Gemini e Engenharia de Prompt (Atualizado)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: 'Você é a Conselheira AtelIA. O usuário enviará uma mensagem de texto (ex: "vendi uma bolsa por 150"). Você deve analisar a intenção e OBRIGATORIAMENTE retornar um objeto JSON válido com três chaves: intent (podendo ser "REGISTER_SALE", "ADD_EXPENSE", "INQUIRY"), amount (um valor numérico extraído da mensagem, ex: 150.00, obrigatório se for venda ou despesa), e replyText (uma resposta humanizada, curta e acolhedora confirmando a ação para ser enviada no WhatsApp).',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent(text);
    const responseText = result.response.text();
    const jsonResponse = JSON.parse(responseText);

    const db = getAdminDb();

    // 3. Resolução de Identidade (Quem é a artesã?)
    // Tenta encontrar pelo campo 'phone' ou 'whatsapp'
    let userId = null;
    let usersSnapshot = await db.collection('users').where('phone', '==', phone).get();
    
    if (usersSnapshot.empty) {
      // Fallback para caso esteja salvo no campo whatsapp
      usersSnapshot = await db.collection('users').where('whatsapp', '==', phone).get();
    }

    if (usersSnapshot.empty) {
      // Override na mensagem gerada se não achar o usuário
      jsonResponse.replyText = 'Desculpe, não encontrei este número cadastrado no AtelIA. Por favor, atualize o seu perfil na plataforma com este número!';
    } else {
      userId = usersSnapshot.docs[0].id;

      // 4. Execução de Ações (O Braço no Firestore)
      switch (jsonResponse.intent) {
        case 'REGISTER_SALE':
          if (jsonResponse.amount) {
            await db.collection('finance_entries').add({
              userId,
              amount: Number(jsonResponse.amount),
              type: 'income',
              description: 'Venda registrada via WhatsApp',
              createdAt: new Date(),
            });
            console.log(`[Intent] Venda de ${jsonResponse.amount} registrada para ${userId}`);
          }
          break;
        case 'ADD_EXPENSE':
          if (jsonResponse.amount) {
            await db.collection('finance_entries').add({
              userId,
              amount: Number(jsonResponse.amount),
              type: 'expense',
              description: 'Despesa registrada via WhatsApp',
              createdAt: new Date(),
            });
            console.log(`[Intent] Despesa de ${jsonResponse.amount} registrada para ${userId}`);
          }
          break;
        case 'INQUIRY':
          // Apenas responde a dúvida usando o replyText gerado
          console.log(`[Intent] Respondendo dúvida de ${userId}`);
          break;
        default:
          console.log(`[Intent] Intenção desconhecida: ${jsonResponse.intent}`);
      }
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
