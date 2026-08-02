'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useTenant } from '@/lib/TenantProvider';
import { getGreetings } from '@/utils/greetings';

interface OnboardingChecklistProps {
  hasEstoque: boolean;
  hasCatalogo: boolean;
  hasPedidos: boolean;
}

export function OnboardingChecklist({ hasEstoque, hasCatalogo, hasPedidos }: OnboardingChecklistProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { firstName, pronoun } = useTenant();
  const g = getGreetings(pronoun);

  useEffect(() => {
    const isDismissed = localStorage.getItem('onboarding_dismissed');
    if (isDismissed === 'true') {
      setIsVisible(false);
      return;
    }

    if (!hasEstoque || !hasCatalogo || !hasPedidos) {
      setIsVisible(true);
    }
  }, [hasEstoque, hasCatalogo, hasPedidos]);

  const handleDismiss = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const displayName = firstName || g.artisan;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 md:p-8 mb-8 relative shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <button 
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-amber-500 hover:text-amber-700 hover:bg-amber-100 p-2 rounded-full transition-colors"
        title="Pular tutorial"
      >
        <X size={20} />
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-black text-amber-900 mb-2">{g.welcome} ao AtelIA, {displayName}! Vamos preparar o seu ateliê? ✨</h2>
        <p className="text-amber-700 font-medium">Siga estes 3 passos rápidos para começar a lucrar e organizar o seu negócio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Passo 1 */}
        <Link 
          href="/estoque" 
          className={`group flex items-center p-4 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${hasEstoque ? 'bg-surface border-emerald-200 opacity-70' : 'bg-surface border-amber-300 shadow-sm'}`}
        >
          <div className="mr-4">
            {hasEstoque ? <CheckCircle2 className="text-emerald-500" size={28} /> : <Circle className="text-amber-400 group-hover:text-amber-500" size={28} />}
          </div>
          <div>
            <p className="font-bold text-sm text-slate-500 uppercase mb-1">Passo 1</p>
            <p className={`font-black ${hasEstoque ? 'text-slate-600 line-through' : 'text-slate-800'}`}>Cadastre seu primeiro material</p>
          </div>
        </Link>

        {/* Passo 2 */}
        <Link 
          href="/calculadora" 
          className={`group flex items-center p-4 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${hasCatalogo ? 'bg-surface border-emerald-200 opacity-70' : 'bg-surface border-amber-300 shadow-sm'}`}
        >
          <div className="mr-4">
            {hasCatalogo ? <CheckCircle2 className="text-emerald-500" size={28} /> : <Circle className="text-amber-400 group-hover:text-amber-500" size={28} />}
          </div>
          <div>
            <p className="font-bold text-sm text-slate-500 uppercase mb-1">Passo 2</p>
            <p className={`font-black ${hasCatalogo ? 'text-slate-600 line-through' : 'text-slate-800'}`}>Calcule o preço de uma peça</p>
          </div>
        </Link>

        {/* Passo 3 */}
        <Link 
          href="/pedidos" 
          className={`group flex items-center p-4 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${hasPedidos ? 'bg-surface border-emerald-200 opacity-70' : 'bg-surface border-amber-300 shadow-sm'}`}
        >
          <div className="mr-4">
            {hasPedidos ? <CheckCircle2 className="text-emerald-500" size={28} /> : <Circle className="text-amber-400 group-hover:text-amber-500" size={28} />}
          </div>
          <div>
            <p className="font-bold text-sm text-slate-500 uppercase mb-1">Passo 3</p>
            <p className={`font-black ${hasPedidos ? 'text-slate-600 line-through' : 'text-slate-800'}`}>Gere um pedido e veja a mágica</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
