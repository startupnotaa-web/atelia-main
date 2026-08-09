'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import {
  PLAN_CYCLES,
  DEFAULT_INTERVAL,
  formatBRL,
  getPlanCycle,
  type BillingInterval,
} from '@/config/plans';

type PricingCyclesProps = {
  onSubscribe: (interval: BillingInterval) => void;
  loading?: boolean;
};

/**
 * Seletor de ciclo de cobrança do AtelIA Pro (Mensal, Trimestral, Semestral, Anual).
 * Os cards são selecionáveis e um único CTA confirma o ciclo escolhido.
 */
export default function PricingCycles({ onSubscribe, loading = false }: PricingCyclesProps) {
  const [selected, setSelected] = useState<BillingInterval>(DEFAULT_INTERVAL);

  const selectedCycle = getPlanCycle(selected)!;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {PLAN_CYCLES.map((cycle) => {
          const isSelected = cycle.interval === selected;
          return (
            <button
              key={cycle.interval}
              type="button"
              onClick={() => setSelected(cycle.interval)}
              aria-pressed={isSelected}
              className={`relative text-left rounded-2xl p-5 pt-6 transition-all border-2 ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              {cycle.badge && (
                <span className="absolute -top-3 left-5 bg-primary text-slate-900 text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                  {cycle.badge}
                </span>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black uppercase tracking-wider text-slate-500">
                  {cycle.label}
                </span>
                <span
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-primary border-primary text-slate-900' : 'border-slate-300 text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={4} />
                </span>
              </div>

              <p className="text-3xl font-black text-slate-900">
                R$ {formatBRL(cycle.monthlyEquivalent)}
                <span className="text-base text-slate-500 font-medium">/mês</span>
              </p>

              <p className="text-sm text-slate-500 font-medium mt-1">
                {cycle.months === 1
                  ? cycle.description
                  : `R$ ${formatBRL(cycle.total)} a cada ${cycle.months} meses`}
              </p>

              {cycle.savings > 0 && (
                <span className="inline-block mt-3 bg-green-100 text-green-700 text-xs font-black px-3 py-1 rounded-full">
                  Economize R$ {formatBRL(cycle.savings)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSubscribe(selected)}
        disabled={loading}
        className="w-full bg-primary hover:bg-primary-hover text-slate-900 font-black text-xl py-5 rounded-2xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={24} /> Redirecionando...
          </>
        ) : (
          <>
            <Sparkles size={22} />
            Assinar {selectedCycle.label} — R$ {formatBRL(selectedCycle.total)}
          </>
        )}
      </button>

      <p className="text-center text-sm text-slate-400 font-medium mt-4">
        Pagamento seguro via Stripe. Cancele quando quiser, sem multa.
      </p>
    </div>
  );
}
