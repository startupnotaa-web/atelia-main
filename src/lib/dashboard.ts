// ============================================================
// lib/dashboard.ts
// Tipos centralizados do Dashboard ERP.
// ============================================================

import type { FinanceEntry } from '@/app/actions/finance';
import type { Order } from '@/app/actions/erp';

export type DashboardMetrics = {
  faturamentoBruto: number;
  recebido: number;
  aReceber: number;
  saldoCaixa: number;
  lucroLiquido: number;
  pedidosPendentes: number;
  estoqueCritico: number;
  prontaEntregaItems: number;
  pedidosProducao: number;
  pedidosFila: number;
  currentMonthRevenue: number;
  /** Soma de `finance_entries` saida com categoria "Matéria-prima" (compra de insumos). */
  despesasMateriaPrima: number;
  /** Soma de `finance_entries` saida com categoria "Marketing"/"Marketing / Embalagem". */
  despesasMarketing: number;
  /** Soma de `finance_entries` saida de qualquer outra categoria. */
  despesasFixas: number;
  /** Valor do estoque de insumos parado (currentStock × custo médio unitário, por item). */
  valorTotalEstoque: number;
  /** Total de documentos em `pedidos` (qualquer status), usado para ticket médio/CAC. */
  totalPedidos: number;
};

export type TopProduct = {
  nome: string;
  quantidadeVendida: number;
  receitaGerada: number;
};

export type EvolutionData = {
  mes: string;
  lucro: number;
};

/** Receita vs despesa por mês — série própria da página /evolucao (gráfico de 2 linhas). */
export type MonthlySeriesData = {
  mes: string;
  receita: number;
  despesa: number;
};

export type DashboardData = {
  plan: string;
  metrics: DashboardMetrics;
  recentExpenses: FinanceEntry[];
  pendingOrders: Order[];
  initialBalance: number;
  topProduct: TopProduct | null;
  evolutionChartData: EvolutionData[];
  monthlySeries: MonthlySeriesData[];
  onboarding: {
    hasEstoque: boolean;
    hasCatalogo: boolean;
    hasPedidos: boolean;
  };
  monthlyGoal: number;
};
