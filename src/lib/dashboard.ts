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

export type DashboardData = {
  plan: string;
  metrics: DashboardMetrics;
  recentExpenses: FinanceEntry[];
  pendingOrders: Order[];
  initialBalance: number;
  topProduct: TopProduct | null;
  evolutionChartData: EvolutionData[];
  onboarding: {
    hasEstoque: boolean;
    hasCatalogo: boolean;
    hasPedidos: boolean;
  };
  monthlyGoal: number;
};
