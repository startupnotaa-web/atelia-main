import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkAIAccess } from '@/lib/checkSubscriptionLimits';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada.' }, { status: 500 });
    }

    const payload = await req.json();
    const { type, metrics, message, history, data, userId } = payload;
    
    if (!userId) {
      return NextResponse.json({ error: 'Usuário não fornecido para validação.' }, { status: 401 });
    }

    try {
      await checkAIAccess(userId);
    } catch (e: any) {
      if (e.message.includes('PLAN_LIMIT_REACHED')) {
        return NextResponse.json({ error: 'PLAN_LIMIT_REACHED' }, { status: 403 });
      }
      throw e;
    }

    // Instância unificada e padronizada
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Fallback unificado helper function
    const executeWithFallback = async (executeFn: (modelName: string) => Promise<any>) => {
      try {
        return await executeFn("gemini-3.5-flash-lite");
      } catch (error) {
        console.warn("Fallback: gemini-3.5-flash-lite failed", error);
        throw new Error('Nossos servidores de IA estão com alta demanda no momento. Por favor, tente novamente em alguns minutos.');
      }
    };

    if (type === 'cfo') {
      const prompt = `
Você é um consultor financeiro especialista em microempreendedorismo e artesanato. 
Analise as seguintes métricas deste ateliê:
${JSON.stringify(metrics, null, 2)}

Se o utilizador tiver uma meta mensal definida (monthlyGoal > 0), atue também como um treinador motivacional. Diga-lhe quanto falta para bater a meta (usando o currentMonthRevenue) e sugira uma ação de marketing ou vendas rápida (ex: fazer uma promoção relâmpago de produtos parados no stock) para o ajudar a chegar lá.

Responda ESTRITAMENTE em formato JSON com EXATAMENTE estas 3 chaves: 
- "saude_geral": Uma string com o diagnóstico claro e encorajador do ateliê em até 2 frases. Se houver meta, inclua aqui a motivação e quanto falta para atingi-la.
- "projecoes": Uma string prevendo de forma realista o que acontecerá nos próximos 3 meses se a tendência atual se mantiver, em até 2 frases.
- "plano_de_acao": Um array de strings contendo exatamente 3 dicas acionáveis e práticas para melhorar a liquidez ou rentabilidade do ateliê. Se houver meta, a primeira dica deve ser focada numa ação rápida para batê-la.

Importante: Não inclua marcação markdown como \`\`\`json no início ou no fim, apenas o JSON puro, pois ele será processado via JSON.parse.
      `;
      
      const result = await executeWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
      });
      
      try {
        return NextResponse.json(JSON.parse(result.response.text()));
      } catch (e) {
        return NextResponse.json({ 
          saude_geral: 'Não foi possível formatar a resposta da IA no momento.',
          projecoes: 'Tente novamente mais tarde.',
          plano_de_acao: ['Tentar analisar novamente em alguns minutos.']
        });
      }
    } 
    
    if (type === 'conselheiro') {
      const prompt = `
Analise os seguintes dados agregados do ERP do ateliê:
- Faturamento Total: R$ ${metrics.faturamentoTotal?.toFixed(2) || '0.00'}
- Lucro Líquido: R$ ${metrics.lucroLiquido?.toFixed(2) || '0.00'}
- Total de Despesas: R$ ${metrics.totalDespesas?.toFixed(2) || '0.00'}
- Pedidos Totais: ${metrics.totalPedidos || 0}

Forneça uma análise rápida e objetiva sobre a saúde financeira. Responda apenas com o texto da sua análise, sem marcações desnecessárias.
      `;
      
      const result = await executeWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: "Você é um CFO (Diretor Financeiro) virtual de um ateliê. A sua função é estritamente analisar números, faturamento, despesas, margens de lucro e fluxo de caixa. Forneça respostas diretas, frias e objetivas sobre a saúde financeira do negócio. Não dê conselhos de marketing ou artesanato. Foque apenas em finanças, corte de gastos e projeções de lucro."
        });
        return await model.generateContent(prompt);
      });
      return NextResponse.json({ result: result.response.text() });
    }

    if (type === 'assistente') {
      let formattedHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // A API do Gemini exige que o primeiro item do histórico seja do 'user'
      while (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        formattedHistory.shift();
      }

      
      const result = await executeWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          systemInstruction: "Foco em marketing, vendas e gestão de negócio"
        });
        const chat = model.startChat({ history: formattedHistory });
        return await chat.sendMessage(message || '');
      });
      return NextResponse.json({ result: result.response.text() });
    }

    if (type === 'admin') {
      const prompt = `
Você é um Analista de Crescimento (Growth Hacker) de SaaS. 
Analise as métricas globais da plataforma AtelIA:
- Usuários Totais: ${metrics.totalUsers}
- Usuários Free: ${metrics.freeUsers}
- Usuários Pro: ${metrics.proUsers}
- Total de Lançamentos Financeiros (Engajamento): ${metrics.totalFinanceEntries}
- Total de Pedidos Feitos: ${metrics.totalOrders}
- Itens de Catálogo Cadastrados: ${metrics.totalCatalogItems}

Forneça 3 recomendações claras e acionáveis sobre como melhorar a conversão, reduzir o churn (cancelamentos) ou onde o CEO deve focar os esforços de marketing nesta semana. Formate a resposta estritamente em Markdown.
      `;
      const result = await executeWithFallback(async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent(prompt);
      });
      return NextResponse.json({ result: result.response.text() });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  } catch (error: any) {
    console.error('Error in Unified AI API:', error);
    
    const userMessage = error.message?.includes('alta demanda') 
      ? error.message 
      : 'Nossos servidores de IA estão com alta demanda no momento. Por favor, tente novamente em alguns minutos.';

    // Para chamadas que esperam JSON puro vs chamadas que esperam texto formatado
    return NextResponse.json({ 
      error: error.message,
      result: userMessage,
      saude_geral: 'Não foi possível analisar os dados no momento.',
      projecoes: userMessage,
      plano_de_acao: [userMessage]
    }, { status: 200 }); // Status 200 to prevent frontend crashes, handled gracefully
  }
}
