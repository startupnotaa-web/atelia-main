'use client';

import React from 'react';
import type { PricingBreakdownItem } from '@/lib/pricingEngine';

// Ordem fixa de cores por categoria — nunca ciclada, para a identidade de cada
// fatia do custo se manter estável entre re-renders (ex: "Materiais" é sempre laranja).
const SLICE_COLORS = [
  'bg-primary',       // Materiais
  'bg-secondary',     // Mão de Obra
  'bg-amber-400',     // Ferramentas
  'bg-slate-400',     // Custos Fixos
  'bg-sky-400',       // Embalagem/Frete
  'bg-rose-400',      // Taxas
  'bg-success',       // Lucro
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function CostReceipt({
  items,
  total,
}: {
  items: PricingBreakdownItem[];
  total: number;
}) {
  const visibleItems = items.filter((item) => item.valor > 0);
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="space-y-3">
      <div className="flex w-full h-3 rounded-full overflow-hidden bg-background border border-border" role="img" aria-label="Distribuição do preço final por categoria de custo">
        {visibleItems.map((item, idx) => (
          <div
            key={item.label}
            className={`${SLICE_COLORS[idx % SLICE_COLORS.length]} h-full`}
            style={{ width: `${(item.valor / safeTotal) * 100}%` }}
            title={`${item.label}: ${formatCurrency(item.valor)}`}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {visibleItems.map((item, idx) => (
          <li key={item.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600 font-medium">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${SLICE_COLORS[idx % SLICE_COLORS.length]}`} />
              {item.label}
            </span>
            <span className="text-slate-800 font-bold tabular-nums">
              {formatCurrency(item.valor)}
              <span className="text-slate-400 font-medium ml-1.5 text-xs">
                ({((item.valor / safeTotal) * 100).toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
