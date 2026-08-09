import { Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { useTenant } from '@/lib/TenantProvider';
import { getGreetings } from '@/utils/greetings';
import PricingCycles from '@/components/PricingCycles';
import type { BillingInterval } from '@/config/plans';

type PaywallProps = {
  title?: string;
  description?: string;
};

export default function Paywall({
  title = "Funcionalidade Premium",
  description = "Faça o Upgrade para desbloquear esta e outras ferramentas incríveis para o seu ateliê."
}: PaywallProps) {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { pronoun } = useTenant();
  const g = getGreetings(pronoun);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const handleUpgrade = async (interval: BillingInterval) => {
    if (!userId) {
      alert(`Você precisa estar ${g.loggedIn} para assinar.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interval,
          userId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro retornado pelo servidor.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Não foi possível gerar o link de checkout.");
      }
    } catch (error: any) {
      console.error("Erro detalhado no checkout:", error);
      toast.error(error.message || "Erro ao iniciar o checkout. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-surface border-4 border-border rounded-[2.5rem] p-8 md:p-12 max-w-2xl w-full text-center shadow-lg relative overflow-hidden">

        {/* Background Brilho */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 border-4 border-border">
            <Lock size={40} className="text-slate-400" />
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-secondary mb-3">{title}</h2>
          <p className="text-lg text-slate-500 font-medium mb-8 max-w-lg leading-relaxed">
            {description}
          </p>

          <PricingCycles onSubscribe={handleUpgrade} loading={loading} />
        </div>

      </div>
    </div>
  );
}
