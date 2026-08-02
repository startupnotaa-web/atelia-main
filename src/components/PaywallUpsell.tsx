'use client';

import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PaywallUpsellProps {
  title?: string;
  description?: string;
}

export default function PaywallUpsell({ 
  title = "Recurso Exclusivo Pro",
  description = "Desbloqueie o poder da Inteligência Artificial e da Análise Estratégica assinando o plano Profissional."
}: PaywallUpsellProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-background p-6 rounded-3xl border border-border shadow-sm text-center">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
        <Lock size={40} className="text-[#B24020]" />
        <Sparkles size={24} className="text-primary absolute -top-2 -right-2" />
      </div>
      
      <h2 className="text-3xl font-black text-slate-900 mb-4">{title}</h2>
      <p className="text-lg text-slate-600 font-medium max-w-md mb-8">
        {description}
      </p>

      <div className="space-y-4 w-full max-w-sm">
        <Link 
          href="/perfil" // Rota correta de conta/upgrade
          className="w-full bg-secondary hover:bg-[#132A4A] text-white font-black text-lg py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02]"
        >
          Fazer Upgrade Agora
          <ArrowRight size={20} />
        </Link>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          A partir de R$ 49/mês
        </p>
      </div>
    </div>
  );
}
