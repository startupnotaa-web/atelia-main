'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type DataPoint = {
  mes: string;
  receita: number;
  despesa: number;
};

type Props = {
  data: DataPoint[];
};

export function RevenueEvolutionChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-bold text-sm text-center px-4">
        Nenhuma transação neste período.
      </div>
    );
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis 
          dataKey="mes" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748B', fontSize: 12 }} 
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748B', fontSize: 12 }} 
          tickFormatter={(val) => `R$ ${val}`} 
        />
        <Tooltip 
          cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          formatter={(value: any) => formatCurrency(Number(value) || 0)}
          itemStyle={{ fontWeight: 'bold' }}
        />
        <Area type="monotone" dataKey="receita" name="Receitas" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
        <Area type="monotone" dataKey="despesa" name="Despesas" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
