'use client';

import { useEffect, useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, 
  Plus, Calendar, ArrowUpRight, ArrowDownRight,
  Package, Check, X, Loader2, Edit3, Clock, Lock, Sparkles, AlertTriangle, AlertCircle, ShoppingBag, Target
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchDashboardData } from '@/app/actions/dashboard';
import { addFinanceEntry, updateInitialBalance } from '@/app/actions/finance';
import type { FinanceEntryType } from '@/app/actions/finance';
// Removed fetchAIAdvice import
import { updateMonthlyGoal } from '@/app/actions/user';
import type { DashboardData } from '@/lib/dashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChatbotWidget } from '@/components/ChatbotWidget';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { useTenant } from '@/lib/TenantProvider';
import { getGreetings, getTimeGreeting } from '@/utils/greetings';
import Link from 'next/link';
import { auth } from '@/lib/firebase';

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 20); // 20ms per character
    return () => clearInterval(interval);
  }, [text]);
  
  return <div dangerouslySetInnerHTML={{ __html: displayed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
}

export default function DashboardPage() {
  const { userId, isPro: isTenantPro, currentPlan, firstName, pronoun } = useTenant();
  const greeting = getGreetings(pronoun);
  const timeGreeting = getTimeGreeting();
  const displayFirstName = firstName || greeting.artisan;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(true);
  
  // Modals
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  
  // Period Filter
  const [period, setPeriod] = useState('Este Mês');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Forms
  const [financeForm, setFinanceForm] = useState({
    type: 'saida' as FinanceEntryType,
    category: 'Matéria-prima',
    value: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [newBalance, setNewBalance] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const getPeriodFilter = (p: string, start: string, end: string) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const formatDateStr = (d: Date) => {
      // ajusta timezone issue para pegar YYYY-MM-DD exato local
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    };

    if (p === 'Este Mês') {
      return { start: formatDateStr(new Date(y, m, 1)), end: formatDateStr(new Date(y, m + 1, 0)) };
    }
    if (p === 'Mês Passado') {
      return { start: formatDateStr(new Date(y, m - 1, 1)), end: formatDateStr(new Date(y, m, 0)) };
    }
    if (p === 'Este Ano') {
      return { start: formatDateStr(new Date(y, 0, 1)), end: formatDateStr(new Date(y, 11, 31)) };
    }
    if (p === 'Personalizado' && start && end) {
      return { start, end };
    }
    return undefined; // Todo o Período
  };

  const loadData = async (forcePeriod?: string, forceStart?: string, forceEnd?: string) => {
    if (!userId) return;
    const filter = getPeriodFilter(forcePeriod ?? period, forceStart ?? customStart, forceEnd ?? customEnd);
    const res = await fetchDashboardData(userId, filter);
    setData(res);
    setNewBalance(res.initialBalance.toString());
    setLoading(false);
    setRefreshing(false);
    
    try {
      setLoadingAi(true);
      const reducedMetrics = {
        faturamentoTotal: res.metrics.faturamentoBruto || 0,
        lucroLiquido: res.metrics.lucroLiquido || 0,
        totalDespesas: (res.metrics.faturamentoBruto || 0) - (res.metrics.lucroLiquido || 0),
        totalPedidos: res.metrics.pedidosPendentes || 0
      };

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'conselheiro', metrics: reducedMetrics, userId: auth.currentUser?.uid })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} - ${response.statusText}`);
      }
      
      const aiData = await response.json();
      if (aiData.error && process.env.NODE_ENV === 'development') {
        throw new Error(aiData.error);
      }
      
      setAiAdvice(aiData.result || 'O conselheiro de IA está indisponível no momento.');
    } catch (e: any) {
      console.error('Falha na IA:', e);
      setAiAdvice(`Ocorreu um erro: ${e.message}`);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      await updateMonthlyGoal(userId, Number(newGoal));
      toast.success('Meta atualizada com sucesso!');
      setIsGoalModalOpen(false);
      setNewGoal('');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar meta');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const handleAddFinanceEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const dataToSend = {
      type: financeForm.type as FinanceEntryType,
      category: financeForm.category,
      value: Number(financeForm.value),
      description: financeForm.description,
      date: financeForm.date
    };

    if (!userId) {
      toast.error('Usuário não autenticado');
      setSaving(false);
      return;
    }

    const res = await addFinanceEntry(dataToSend, userId);
    if (res.success) {
      setIsFinanceModalOpen(false);
      setFinanceForm({ type: 'saida', category: 'Matéria-prima', value: '', description: '', date: new Date().toISOString().split('T')[0] });
      toast.success('Lançamento registrado!');
      setRefreshing(true);
      await loadData();
    } else {
      toast.error(res.error || 'Falha ao registrar o lançamento');
    }
    setSaving(false);
  };

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const res = await updateInitialBalance(Number(newBalance), userId);
    if (res.success) {
      setIsBalanceModalOpen(false);
      toast.success('Saldo inicial atualizado!');
      setRefreshing(true);
      await loadData();
    } else {
      toast.error(res.error || 'Erro ao atualizar saldo');
    }
    setSaving(false);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (isoString: string) => {
    if(!isoString) return '';
    const parts = isoString.split('-');
    if(parts.length !== 3) return isoString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const renderProFeature = (content: React.ReactNode, title: string) => {
    const isPro = isTenantPro || currentPlan?.toLowerCase() === 'intermediario';
    if (isPro) return content;
    
    return (
      <div className="relative overflow-hidden w-full h-full rounded-[2rem] bg-surface shadow-sm flex flex-col border-2 border-border">
        <div className="flex-1 blur-[6px] opacity-40 p-6 pointer-events-none select-none">
          {content}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-surface/30 backdrop-blur-[1px]">
          <div className="bg-surface p-4 rounded-full shadow-lg mb-4 border border-amber-100">
            <Lock className="text-amber-500" size={28} />
          </div>
          <h3 className="font-black text-xl text-slate-900 mb-2">{title}</h3>
          <p className="text-sm font-bold text-slate-600 mb-6 max-w-[200px]">Desbloqueie insights valiosos para seu ateliê.</p>
          <Link href="/minha-conta" className="bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 text-sm uppercase tracking-wide">
            Obter Plano Pro
          </Link>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-foreground" size={48} />
      </div>
    );
  }

  if (!data) return null;

  const m = data.metrics;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">{timeGreeting}, {displayFirstName}! ✨</h1>
          <p className="text-success mt-1 font-bold">{greeting.welcome} de volta ao seu ateliê. Aqui está o resumo do dia.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsFinanceModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <DollarSign size={20} />
            Lançar Despesa
          </button>
          <Link 
            href="/pedidos"
            className="bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Pedido
          </Link>
        </div>
      </header>

      {/* ONBOARDING */}
      {data.onboarding && (
        <OnboardingChecklist 
          hasEstoque={data.onboarding.hasEstoque} 
          hasCatalogo={data.onboarding.hasCatalogo} 
          hasPedidos={data.onboarding.hasPedidos} 
        />
      )}

      {/* GAMIFICATION WIDGET */}
      <div className="mb-10 bg-surface rounded-3xl p-6 md:p-8 shadow-sm border-2 border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <TrendingUp size={120} />
        </div>
        
        {data.monthlyGoal > 0 ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2 mb-1">
                  <TrendingUp className="text-purple-500" />
                  Meta do Mês
                </h2>
                <p className="text-slate-500 font-medium text-sm">Acompanhe o seu progresso rumo ao faturamento de {formatCurrency(data.monthlyGoal)}</p>
              </div>
              <div className="text-right mt-4 md:mt-0 flex flex-col items-end">
                 <div className="flex items-baseline">
                   <span className="text-3xl font-black text-foreground">{formatCurrency(data.metrics.currentMonthRevenue)}</span>
                   <span className="text-slate-400 font-bold ml-2">/ {formatCurrency(data.monthlyGoal)}</span>
                 </div>
                 <button 
                   onClick={() => setIsGoalModalOpen(true)}
                   className="text-xs font-bold text-slate-400 hover:text-foreground flex items-center gap-1 mt-1 transition-colors"
                 >
                   <Edit3 size={12} /> Editar Meta
                 </button>
              </div>
            </div>
            
            {(() => {
              const pct = Math.min(100, (data.metrics.currentMonthRevenue / data.monthlyGoal) * 100);
              const isCompleted = pct >= 100;
              let msg = '';
              if (isCompleted) msg = 'Parabéns! Meta do mês batida! 🏆';
              else if (pct < 50) msg = 'Vamos lá, o mês ainda agora começou!';
              else if (pct < 80) msg = 'Você está no caminho certo, continue divulgando!';
              else msg = 'Falta muito pouco para bateres a tua meta, continua a divulgar!';
              
              return (
                <div className="relative z-10">
                  <div className="flex justify-between items-end mb-2">
                    <span className={`font-bold text-sm ${isCompleted ? 'text-emerald-600' : 'text-purple-600'}`}>
                      {pct.toFixed(1)}% da meta alcançada!
                    </span>
                    <span className="font-bold text-sm text-slate-500">{msg}</span>
                  </div>
                  <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden border border-border">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center text-center py-6">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4">
              <Target size={32} />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2">Desbloqueie a Gamificação!</h2>
            <p className="text-slate-500 font-medium max-w-md mx-auto mb-6">
              Defina a sua meta de faturamento mensal e acompanhe o seu progresso em tempo real com gráficos motivacionais.
            </p>
            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Target size={20} />
              Definir Minha Meta Mensal
            </button>
          </div>
        )}
      </div>

      {/* PERIOD FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-surface p-4 md:px-6 md:py-4 rounded-3xl shadow-sm border-2 border-border relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground">Período Financeiro</h2>
            <p className="text-xs font-bold text-slate-400">Filtrar resultados dos cards abaixo</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <select 
            value={period} 
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value !== 'Personalizado') {
                setRefreshing(true);
                loadData(e.target.value);
              }
            }}
            className="w-full md:w-auto px-4 py-2.5 bg-background border-2 border-border rounded-xl focus:border-secondary font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="Este Mês">Este Mês</option>
            <option value="Mês Passado">Mês Passado</option>
            <option value="Este Ano">Este Ano</option>
            <option value="Todo o Período">Todo o Período</option>
            <option value="Personalizado">Personalizado</option>
          </select>
          
          {period === 'Personalizado' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2.5 bg-background border-2 border-border rounded-xl font-bold text-slate-700 outline-none focus:border-secondary text-sm w-full"
              />
              <span className="text-slate-400 font-bold text-sm">até</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2.5 bg-background border-2 border-border rounded-xl font-bold text-slate-700 outline-none focus:border-secondary text-sm w-full"
              />
              <button 
                onClick={() => {
                  setRefreshing(true);
                  loadData('Personalizado', customStart, customEnd);
                }}
                disabled={!customStart || !customEnd}
                className="bg-secondary text-white p-2.5 rounded-xl hover:bg-secondary-hover transition-colors disabled:opacity-50"
                title="Aplicar Filtro"
              >
                <Check size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TOP GRID (KPI Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Faturamento Bruto (FREE) */}
        <div className="bg-surface rounded-3xl p-6 shadow-sm border-2 border-border flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <p className="font-bold text-slate-500 uppercase tracking-wider text-sm">Faturamento</p>
          </div>
          <p className="text-3xl font-black text-slate-800">{formatCurrency(m.faturamentoBruto)}</p>
        </div>

        {/* Recebido (FREE) */}
        <div className="bg-surface rounded-3xl p-6 shadow-sm border-2 border-emerald-100 flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ArrowDownRight size={24} />
            </div>
            <p className="font-bold text-emerald-700 uppercase tracking-wider text-sm">Já Recebido</p>
          </div>
          <p className="text-3xl font-black text-emerald-800">{formatCurrency(m.recebido)}</p>
        </div>

        {/* A Receber (FREE) */}
        <div className="bg-surface rounded-3xl p-6 shadow-sm border-2 border-amber-100 flex flex-col relative overflow-hidden">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock size={24} />
            </div>
            <p className="font-bold text-amber-700 uppercase tracking-wider text-sm">A Receber</p>
          </div>
          <p className="text-3xl font-black text-amber-800">{formatCurrency(m.aReceber)}</p>
        </div>

        {/* Lucro Líquido (PRO) */}
        {renderProFeature(
          <div className="bg-secondary rounded-3xl p-6 shadow-lg shadow-secondary/20 flex flex-col relative overflow-hidden w-full h-full">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-surface/5 rounded-full blur-2xl"></div>
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-surface/10 text-white flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <Wallet size={24} />
                </div>
                <p className="font-bold text-blue-200 uppercase tracking-wider text-sm">Lucro Líquido</p>
              </div>
            </div>
            <p className="text-4xl font-black text-white relative z-10">{formatCurrency(m.lucroLiquido)}</p>
          </div>,
          "Lucro Líquido"
        )}
      </div>

      {/* MIDDLE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
        
        {/* Evolution Chart (60%) */}
        <div className="lg:col-span-3 bg-surface rounded-3xl p-6 shadow-sm border-2 border-border flex flex-col">
          <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="text-slate-400" />
            Evolução Mensal (Caixa)
          </h2>
          <div className="h-64 w-full">
            {data.evolutionChartData && data.evolutionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.evolutionChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} tickFormatter={(val) => `R$ ${val}`} width={80} />
                  <Tooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Movimentação']}
                  />
                  <Bar dataKey="lucro" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">Nenhum dado de evolução.</div>
            )}
          </div>
        </div>

        {/* AI Consultant + Próximos Recebimentos (40%) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* AI Consultant Widget */}
          <div className="bg-gradient-to-br from-secondary to-secondary-hover rounded-3xl p-6 shadow-lg text-white flex flex-col relative overflow-hidden flex-1 min-h-[220px]">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Sparkles size={120} />
            </div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center border border-white/20">
                <span className="text-xl">✨</span>
              </div>
              <h2 className="text-xl font-black">Conselheira AtelIA</h2>
            </div>
            <div className="flex-1 flex items-start bg-surface/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm shadow-inner relative z-10 overflow-y-auto">
              {loadingAi ? (
                <div className="flex w-full justify-center items-center gap-3 text-white/70 py-8">
                  <Loader2 className="animate-spin" size={24} />
                  <span className="font-bold text-sm">Analisando suas métricas...</span>
                </div>
              ) : (
                <div className="text-[15px] font-medium leading-relaxed prose prose-invert prose-p:my-2 prose-strong:text-primary">
                  <TypewriterText text={aiAdvice} />
                </div>
              )}
            </div>
          </div>
          
          {/* Próximos Recebimentos */}
          <div className="bg-surface rounded-3xl border-2 border-border shadow-sm p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                <Clock className="text-slate-400" size={20} />
                Próximos Valores
              </h2>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[200px] pr-2">
              {(() => {
                const filteredOrders = data.pendingOrders.filter(order => {
                  if ((order as any).status === 'cancelado' || (order as any).statusProducao === 'cancelado') return false;
                  
                  const totalValue = Number(order.totalValue) || Number(order.valorFinal) || Number(order.valor) || 0;
                  let paidValue = 0;
                  if (order.paidValue !== undefined && order.paidValue !== null) {
                    paidValue = Number(order.paidValue);
                  } else {
                    if (order.statusPagamento === 'pago') paidValue = totalValue;
                    else if (order.statusPagamento === 'sinal') paidValue = totalValue / 2;
                  }
                  
                  return totalValue > paidValue;
                });

                if (filteredOrders.length === 0) {
                  return (
                    <div className="py-6 text-center">
                      <p className="text-slate-400 font-bold text-sm">Nada a receber.</p>
                    </div>
                  );
                }

                return filteredOrders.map(order => {
                  let title = order.clientName || order.cliente;
                  if (!title) {
                    title = order.items?.[0]?.name || order.produto || 'Pedido sem nome';
                    const itemsCount = order.items?.length || 0;
                    if (itemsCount > 1) {
                      title += ` (+${itemsCount - 1} itens)`;
                    }
                  }

                  const totalValue = Number(order.totalValue) || Number(order.valorFinal) || Number(order.valor) || 0;
                  let paidValue = 0;
                  if (order.paidValue !== undefined && order.paidValue !== null) {
                    paidValue = Number(order.paidValue);
                  } else {
                    if (order.statusPagamento === 'pago') paidValue = totalValue;
                    else if (order.statusPagamento === 'sinal') paidValue = totalValue / 2;
                  }
                  const pendingValue = totalValue - paidValue;
                  const orderDate = order.deadline || order.data || '';

                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl border-2 border-slate-50 bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm truncate max-w-[120px]" title={title}>{title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Prazo: {formatDate(orderDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm text-amber-600">
                          {formatCurrency(pendingValue)}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Status da Produção (Pedidos) - FREE */}
        <div className="bg-surface rounded-3xl border-2 border-border shadow-sm p-6 md:p-8 flex flex-col">
          <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <Package className="text-slate-400" />
            Status da Produção
          </h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="bg-background border-2 border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <span className="text-5xl font-black text-foreground mb-2">{m.pedidosFila}</span>
              <span className="text-sm font-bold text-slate-500 uppercase">Pedidos na Fila</span>
            </div>
            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
              <span className="text-5xl font-black text-amber-600 mb-2">{m.pedidosProducao}</span>
              <span className="text-sm font-bold text-amber-700 uppercase">Em Produção</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Link href="/pedidos" className="text-foreground font-bold hover:underline text-sm flex items-center gap-1">
              Ver todos os pedidos <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        {/* Alertas de Estoque e Pronta Entrega - PRO */}
        {renderProFeature(
          <div className="bg-surface rounded-[2rem] p-6 md:p-8 flex flex-col w-full h-full">
            <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
              <AlertTriangle className="text-slate-400" />
              Gestão de Estoque
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div className={`border-2 rounded-2xl p-6 flex flex-col items-center justify-center text-center ${m.estoqueCritico > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                {m.estoqueCritico > 0 ? (
                  <AlertCircle size={32} className="text-red-500 mb-3" />
                ) : (
                  <Check size={32} className="text-emerald-500 mb-3" />
                )}
                <span className={`text-4xl font-black mb-2 ${m.estoqueCritico > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.estoqueCritico}
                </span>
                <span className={`text-sm font-bold uppercase ${m.estoqueCritico > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  Itens Críticos (Abaixo da média)
                </span>
              </div>
              <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <ShoppingBag size={32} className="text-indigo-500 mb-3" />
                <span className="text-4xl font-black text-indigo-600 mb-2">{m.prontaEntregaItems}</span>
                <span className="text-sm font-bold text-indigo-700 uppercase">Produtos Prontos (Prateleira)</span>
              </div>
            </div>
          </div>,
          "Gestão de Estoque Avançada"
        )}

      </div>

      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
              <h2 className="text-xl font-black text-foreground">Definir Meta Mensal</h2>
              <button 
                onClick={() => setIsGoalModalOpen(false)}
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-slate-400 hover:text-foreground shadow-sm hover:shadow transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateGoal} className="p-6">
              <p className="text-sm text-slate-500 mb-6">
                Estabeleça um objetivo de faturamento para este mês. Acompanharemos o seu progresso na Dashboard!
              </p>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Valor da Meta (R$)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold">R$</span>
                  </div>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-background border-2 border-border rounded-xl focus:border-secondary focus:ring-0 transition-colors font-bold text-slate-800 text-lg"
                    placeholder="Ex: 2500,00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-secondary hover:bg-secondary-hover text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFinanceModalOpen && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-background/50">
              <h2 className="text-xl font-black text-foreground">Lançar Nova Despesa</h2>
              <button 
                onClick={() => setIsFinanceModalOpen(false)}
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-slate-400 hover:text-foreground shadow-sm hover:shadow transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddFinanceEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
                <input required type="text" value={financeForm.description} onChange={e => setFinanceForm({...financeForm, description: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium" placeholder="Ex: Compra de embalagens" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Valor (R$)</label>
                  <input required type="number" step="0.01" min="0.01" value={financeForm.value} onChange={e => setFinanceForm({...financeForm, value: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-bold" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Data</label>
                  <input required type="date" value={financeForm.date} onChange={e => setFinanceForm({...financeForm, date: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium text-slate-700" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                <select required value={financeForm.category} onChange={e => setFinanceForm({...financeForm, category: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium">
                  <option value="Matéria-prima">Matéria-prima</option>
                  <option value="Marketing / Embalagem">Marketing / Embalagem</option>
                  <option value="Despesas Fixas">Despesas Fixas</option>
                  <option value="Impostos / Taxas">Impostos / Taxas</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsFinanceModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ChatbotWidget />
    </div>
  );
}
