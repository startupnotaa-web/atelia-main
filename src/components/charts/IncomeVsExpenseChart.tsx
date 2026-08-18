'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type Props = {
  receita: number;
  despesa: number;
};

export function IncomeVsExpenseChart({ receita, despesa }: Props) {
  if (receita === 0 && despesa === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-bold text-sm text-center px-4">
        Nenhuma transação neste período.
      </div>
    );
  }

  const data = [
    { name: 'Receitas', value: receita },
    { name: 'Despesas', value: despesa }
  ];

  // Earthy/Green for Receitas, Warm/Orange for Despesas
  const COLORS = ['#10B981', '#F97316']; 

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="80%"
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: any) => formatCurrency(Number(value) || 0)}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          itemStyle={{ fontWeight: 'bold' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
