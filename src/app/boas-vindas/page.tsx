'use client';

import Link from 'next/link';
import { useTenant } from '@/lib/TenantProvider';
import { getGreetings } from '@/utils/greetings';
import { Calculator } from 'lucide-react';

export default function BoasVindasPage() {
  const { currentPlan, firstName, pronoun } = useTenant();
  const g = getGreetings(pronoun);
  const displayName = firstName || g.artisan;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center w-full p-6 text-center animate-in fade-in zoom-in duration-500">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl md:text-6xl font-black text-secondary mb-6 leading-tight">
          {g.welcome} à sua nova <br/><span className="text-primary">fase profissional, {displayName}!</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-600 mb-12 font-medium leading-relaxed">
          Sua conta foi criada com sucesso (Plano: <span className="uppercase font-bold text-secondary">{currentPlan}</span>). <br/>
          Você não precisa mais chutar preços. Vamos descobrir o valor real da sua arte?
        </p>

        <Link 
          href="/calculadora" 
          className="inline-flex items-center gap-4 bg-primary hover:bg-primary-hover text-slate-900 font-black text-2xl md:text-3xl px-10 py-6 rounded-3xl transition-transform hover:scale-105 shadow-xl border-4 border-slate-900/5"
        >
          <Calculator size={40} />
          Precificar meu primeiro produto
        </Link>
      </div>
    </div>
  );
}
