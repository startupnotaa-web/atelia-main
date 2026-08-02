'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import PaywallUpsell from '@/components/PaywallUpsell';
import { TrendingUp, Activity, BarChart3, Clock, DollarSign, Package, Percent, Target, HeartPulse, Telescope, CheckSquare, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

type Metrics = {
  margemLucro: number;
  ticketMedio: number;
  roiMateriais: number;
  capitalGiro: number;
  liquidez: number;
  runway: number;
  giroEstoque: number;
  cac: number;
};

type AIAnalysis = {
  saude_geral?: string;
  projecoes?: string;
  plano_de_acao?: string[];
};

export default function EvolucaoPage() {
  const { isPro, userId } = useTenant();
  
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<AIAnalysis | null>(null);
  
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (isPro && userId) {
      loadFinancialData();
    }
  }, [isPro, userId]);

  const loadFinancialData = async () => {
    if (!userId) return;
    setLoadingData(true);
    try {
      const [financeSnap, pedidosSnap, estoqueSnap] = await Promise.all([
        getDocs(query(collection(db, 'finance_entries'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'pedidos'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'estoque'), where('userId', '==', userId)))
      ]);

      let totalReceita = 0;
      let totalCustoProducao = 0;
      let despesasFixas = 0;
      let despesasMarketing = 0;
      
      let caixaAtual = 0;
      let contasReceber = 0;
      
      const pedidosAgrupadosPorMes: Record<string, { receita: number, despesa: number }> = {};

      // 1. Processar Pedidos (Receitas e Recebíveis)
      const numPedidos = pedidosSnap.size;
      pedidosSnap.forEach(doc => {
        const data = doc.data();
        const valor = Number(data.valorFinal) || Number(data.valor) || Number(data.totalValue) || 0;
        
        let pago = 0;
        if (data.statusPagamento === 'pago') pago = valor;
        else if (data.statusPagamento === 'sinal') pago = valor / 2;
        else if (data.statusPagamento === 'pendente') pago = 0;
        else pago = Number(data.paidValue) || 0; // Legacy
        
        const aReceber = valor - pago;
        
        totalReceita += valor;
        contasReceber += aReceber;
        caixaAtual += pago;

        // Para o gráfico
        const dateString = data.data || data.createdAt || data.orderDate;
        if (dateString) {
          const date = new Date(typeof dateString?.toDate === 'function' ? dateString.toDate() : dateString);
          if (!isNaN(date.getTime())) {
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            if (!pedidosAgrupadosPorMes[monthYear]) pedidosAgrupadosPorMes[monthYear] = { receita: 0, despesa: 0 };
            pedidosAgrupadosPorMes[monthYear].receita += valor;
          }
        }
      });

      // 2. Processar Despesas (Finance Entries)
      financeSnap.forEach(doc => {
        const data = doc.data();
        const valor = data.value || 0;
        
        if (data.type === 'saida') {
          caixaAtual -= valor;
          
          if (data.category === 'Matéria-prima') {
            totalCustoProducao += valor;
          } else if (data.category === 'Marketing' || data.category === 'Marketing / Embalagem') {
            despesasMarketing += valor;
          } else {
            despesasFixas += valor;
          }

          // Para o gráfico
          if (data.date) {
            const date = new Date(data.date);
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            if (!pedidosAgrupadosPorMes[monthYear]) pedidosAgrupadosPorMes[monthYear] = { receita: 0, despesa: 0 };
            pedidosAgrupadosPorMes[monthYear].despesa += valor;
          }
        } else if (data.type === 'entrada') {
          caixaAtual += valor;
          totalReceita += valor;

          if (data.date) {
            const date = new Date(data.date);
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            if (!pedidosAgrupadosPorMes[monthYear]) pedidosAgrupadosPorMes[monthYear] = { receita: 0, despesa: 0 };
            pedidosAgrupadosPorMes[monthYear].receita += valor;
          }
        }
      });

      // 3. Processar Estoque
      let valorTotalEstoque = 0;
      estoqueSnap.forEach(doc => {
        const data = doc.data();
        valorTotalEstoque += (data.price || 0) * (data.quantity || 0);
      });

      // Cálculos Matemáticos Avançados
      const lucroLiquido = totalReceita - (totalCustoProducao + despesasFixas + despesasMarketing);
      
      const margemLucro = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0;
      const ticketMedio = numPedidos > 0 ? totalReceita / numPedidos : 0;
      const roiMateriais = totalCustoProducao > 0 ? ((totalReceita - totalCustoProducao) / totalCustoProducao) * 100 : 0;
      const capitalGiro = (caixaAtual + contasReceber) - despesasFixas;
      
      // Assumindo despesas fixas como contas a pagar de curto prazo para métrica
      const liquidez = despesasFixas > 0 ? contasReceber / despesasFixas : (contasReceber > 0 ? 100 : 0);
      
      // Sobrevivência (Runway) em meses
      const mediaDespesasMensais = (despesasFixas + despesasMarketing + totalCustoProducao) / 3 || 1; // media simples 3 meses
      const runway = caixaAtual > 0 ? caixaAtual / mediaDespesasMensais : 0;

      // Giro de estoque (CMV / Estoque médio)
      const giroEstoque = valorTotalEstoque > 0 ? totalCustoProducao / valorTotalEstoque : 0;
      
      // CAC (apenas simulativo baseando em nº pedidos)
      const cac = numPedidos > 0 ? despesasMarketing / numPedidos : 0;

      setMetrics({
        margemLucro,
        ticketMedio,
        roiMateriais,
        capitalGiro,
        liquidez,
        runway,
        giroEstoque,
        cac
      });

      // Format Chart Data
      const formattedChart = Object.keys(pedidosAgrupadosPorMes).map(mes => ({
        mes,
        receita: pedidosAgrupadosPorMes[mes].receita,
        despesa: pedidosAgrupadosPorMes[mes].despesa,
      })).sort((a, b) => {
        // Basic sort por string "MM/YYYY" (ideal: conversão pra data real)
        const [m1, y1] = a.mes.split('/');
        const [m2, y2] = b.mes.split('/');
        return new Date(Number(y1), Number(m1) - 1).getTime() - new Date(Number(y2), Number(m2) - 1).getTime();
      });

      setChartData(formattedChart);

    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
      toast.error('Erro ao processar as métricas.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleGenerateAIReport = async () => {
    if (!metrics) return;
    setLoadingAi(true);
    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cfo',
          userId: auth.currentUser?.uid,
          metrics: {
            ...metrics,
            margemLucro: metrics.margemLucro.toFixed(2) + '%',
            roiMateriais: metrics.roiMateriais.toFixed(2) + '%',
            liquidezCorrente: metrics.liquidez.toFixed(2),
            runwayMeses: metrics.runway.toFixed(1)
          }
        })
      });

      const data = await response.json();
      if (data.saude_geral) {
        setAiReport(data);
      } else {
        throw new Error('Formato inválido');
      }
    } catch (e) {
      setAiReport({
        saude_geral: 'O conselheiro de IA está indisponível no momento.',
        projecoes: 'Tente novamente em alguns minutos.',
        plano_de_acao: ['Os seus dados estão seguros e os gráficos foram renderizados normalmente.']
      });
    } finally {
      setLoadingAi(false);
    }
  };

  if (!isPro) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-10">
        <PaywallUpsell 
          title="Dashboard Financeiro Avançado (PRO)" 
          description="Acesse gráficos avançados, previsões de faturamento, liquidez e métricas de conversão detalhadas calculadas pelo seu CFO Virtual (IA)."
        />
      </div>
    );
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans animate-in fade-in duration-500">
      
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
            <BarChart3 size={28} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">Evolução & Performance</h1>
            <p className="text-slate-500 font-medium">
              Métricas financeiras aprofundadas do seu Ateliê.
            </p>
          </div>
        </div>
      </header>

      {loadingData ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-foreground" size={48} />
        </div>
      ) : metrics ? (
        <>
          {/* Sessão 1: Rentabilidade e Retorno */}
          <h2 className="text-xl font-bold text-slate-800 mb-4">Rentabilidade e Retorno</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><Percent size={20} /> <span className="font-bold">Margem Líquida</span></div>
              <p className={`text-3xl font-black ${metrics.margemLucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {metrics.margemLucro.toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><Target size={20} /> <span className="font-bold">Ticket Médio</span></div>
              <p className="text-3xl font-black text-slate-800">{formatCurrency(metrics.ticketMedio)}</p>
            </div>
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><TrendingUp size={20} /> <span className="font-bold">ROI (Materiais)</span></div>
              <p className="text-3xl font-black text-blue-600">{metrics.roiMateriais.toFixed(1)}%</p>
            </div>
          </div>

          {/* Sessão 2: Liquidez e Saúde */}
          <h2 className="text-xl font-bold text-slate-800 mb-4">Liquidez e Saúde Financeira</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><DollarSign size={20} /> <span className="font-bold">Capital de Giro</span></div>
              <p className="text-3xl font-black text-slate-800">{formatCurrency(metrics.capitalGiro)}</p>
            </div>
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><Activity size={20} /> <span className="font-bold">Índice Liquidez</span></div>
              <p className="text-3xl font-black text-slate-800">{metrics.liquidez.toFixed(2)}</p>
            </div>
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <div className="flex items-center gap-3 text-slate-500 mb-3"><Clock size={20} /> <span className="font-bold">Runway (Sobrevivência)</span></div>
              <p className="text-3xl font-black text-slate-800">{metrics.runway.toFixed(1)} <span className="text-lg text-slate-500 font-medium">meses</span></p>
            </div>
          </div>

          {/* Gráfico */}
          <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border mb-10">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Evolução: Receita vs Despesa</h2>
            <div className="h-80 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" tick={{fill: '#64748B'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{fill: '#64748B'}} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                    <Legend />
                    <Line type="monotone" name="Receita" dataKey="receita" stroke="#10B981" strokeWidth={4} dot={{r: 4}} activeDot={{r: 6}} />
                    <Line type="monotone" name="Despesa" dataKey="despesa" stroke="#EF4444" strokeWidth={4} dot={{r: 4}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold">Nenhum dado financeiro para gerar gráfico.</div>
              )}
            </div>
          </div>

          {/* Relatório CFO IA */}
          <div className="bg-gradient-to-br from-secondary to-secondary-hover rounded-3xl shadow-xl overflow-hidden mb-10">
            <div className="p-8 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <span className="text-3xl">✨</span> CFO Virtual (Inteligência Artificial)
                </h2>
                <p className="text-blue-200 mt-1 font-medium">Diagnóstico preciso e plano de ação baseado nas suas métricas exatas.</p>
              </div>
              <button 
                onClick={handleGenerateAIReport}
                disabled={loadingAi}
                className="bg-primary hover:bg-[#FFB822] text-foreground font-black py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {loadingAi ? <Loader2 size={20} className="animate-spin" /> : <Activity size={20} />}
                {aiReport ? 'Atualizar Análise' : 'Gerar Análise CFO'}
              </button>
            </div>

            <div className="p-8">
              {loadingAi ? (
                <div className="animate-pulse space-y-8">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-surface/20 rounded-2xl"></div>
                    <div className="flex-1 space-y-3 py-2">
                      <div className="h-4 bg-surface/20 rounded w-3/4"></div>
                      <div className="h-4 bg-surface/20 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-surface/20 rounded-2xl"></div>
                    <div className="flex-1 space-y-3 py-2">
                      <div className="h-4 bg-surface/20 rounded w-5/6"></div>
                      <div className="h-4 bg-surface/20 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
              ) : aiReport ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
                  
                  {/* Saúde Geral */}
                  <div className="bg-surface/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4 text-primary">
                      <HeartPulse size={28} />
                      <h3 className="text-xl font-black text-white">Saúde Geral</h3>
                    </div>
                    <p className="text-blue-50 font-medium leading-relaxed">
                      {aiReport.saude_geral}
                    </p>
                  </div>

                  {/* Projeções */}
                  <div className="bg-surface/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4 text-primary">
                      <Telescope size={28} />
                      <h3 className="text-xl font-black text-white">Projeções (3 meses)</h3>
                    </div>
                    <p className="text-blue-50 font-medium leading-relaxed">
                      {aiReport.projecoes}
                    </p>
                  </div>

                  {/* Plano de Ação */}
                  <div className="md:col-span-2 bg-surface/10 p-6 rounded-2xl border border-white/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6 text-primary">
                      <CheckSquare size={28} />
                      <h3 className="text-xl font-black text-white">Plano de Ação</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {aiReport.plano_de_acao?.map((acao, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-8 h-8 shrink-0 bg-primary text-foreground font-black rounded-full flex items-center justify-center">
                            {idx + 1}
                          </div>
                          <p className="text-blue-50 font-medium text-sm leading-relaxed">
                            {acao}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-10 text-white/50">
                  <Telescope size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Clique no botão acima para o CFO analisar suas finanças.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
