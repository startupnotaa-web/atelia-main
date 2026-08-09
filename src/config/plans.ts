// Fonte única de verdade da monetização do AtelIA Pro.
// Valor base: R$ 39,90/mês. Ciclos mais longos ganham desconto progressivo,
// sempre exibidos como "equivalente mensal" + total cobrado por ciclo.
//
// Os Price IDs vêm de variáveis de ambiente — crie os preços no painel do
// Stripe e preencha no .env.local / Vercel:
//   NEXT_PUBLIC_STRIPE_PRICE_MONTHLY     (R$ 39,90 a cada 1 mês)
//   NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY   (R$ 107,70 a cada 3 meses)
//   NEXT_PUBLIC_STRIPE_PRICE_SEMIANNUAL  (R$ 197,40 a cada 6 meses)
//   NEXT_PUBLIC_STRIPE_PRICE_YEARLY      (R$ 358,80 a cada 12 meses)

export type BillingInterval = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export const PRO_BASE_MONTHLY_PRICE = 39.9;

export type PlanCycle = {
  interval: BillingInterval;
  /** Nome exibido na UI (ex: 'Mensal') */
  label: string;
  /** Quantidade de meses cobertos por uma cobrança */
  months: number;
  /** Preço equivalente por mês, usado como número principal na UI */
  monthlyEquivalent: number;
  /** Total cobrado pelo Stripe a cada ciclo */
  total: number;
  /** Economia em R$ vs. pagar o mesmo período no ciclo mensal */
  savings: number;
  /** Selo de destaque opcional (ex: 'Melhor Valor') */
  badge?: string;
  /** Texto curto de apoio abaixo do preço */
  description: string;
};

export const PLAN_CYCLES: PlanCycle[] = [
  {
    interval: 'monthly',
    label: 'Mensal',
    months: 1,
    monthlyEquivalent: 39.9,
    total: 39.9,
    savings: 0,
    description: 'Cancele quando quiser.',
  },
  {
    interval: 'quarterly',
    label: 'Trimestral',
    months: 3,
    monthlyEquivalent: 35.9,
    total: 107.7,
    savings: 12,
    description: 'Cobrança única a cada 3 meses.',
  },
  {
    interval: 'semiannual',
    label: 'Semestral',
    months: 6,
    monthlyEquivalent: 32.9,
    total: 197.4,
    savings: 42,
    badge: 'Mais Popular',
    description: 'Cobrança única a cada 6 meses.',
  },
  {
    interval: 'yearly',
    label: 'Anual',
    months: 12,
    monthlyEquivalent: 29.9,
    total: 358.8,
    savings: 120,
    badge: 'Melhor Valor',
    description: 'Equivale a 3 meses grátis.',
  },
];

export const DEFAULT_INTERVAL: BillingInterval = 'yearly';

export function getPlanCycle(interval: string): PlanCycle | undefined {
  return PLAN_CYCLES.find((c) => c.interval === interval);
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mapeamento estático (necessário para o Next.js inlinar as NEXT_PUBLIC_* no client).
export const STRIPE_PRICE_IDS: Record<BillingInterval, string | undefined> = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
  quarterly: process.env.NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY,
  semiannual: process.env.NEXT_PUBLIC_STRIPE_PRICE_SEMIANNUAL,
  yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY,
};
