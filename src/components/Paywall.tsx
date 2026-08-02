import { Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { useTenant } from '@/lib/TenantProvider';
import { getGreetings } from '@/utils/greetings';

type PaywallProps = {
  title?: string;
  description?: string;
};

export default function Paywall({ 
  title = "Funcionalidade Premium", 
  description = "Faça o Upgrade para desbloquear esta e outras ferramentas incríveis para o seu ateliê." 
}: PaywallProps) {
  const [isAnnual, setIsAnnual] = useState(true);
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

  const handleUpgrade = async () => {
    if (!userId) {
      alert(`Você precisa estar ${g.loggedIn} para assinar.`);
      return;
    }

    setLoading(true);
    try {
      const interval = isAnnual ? 'yearly' : 'monthly';

      const res = await fetch('/api/checkout', {
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
      <div className="bg-surface border-4 border-border rounded-[2.5rem] p-10 md:p-16 max-w-2xl w-full text-center shadow-lg relative overflow-hidden">
        
        {/* Background Brilho */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-8 border-4 border-border">
            <Lock size={48} className="text-slate-400" />
          </div>
          
          <h2 className="text-4xl font-black text-secondary mb-4">{title}</h2>
          <p className="text-xl text-slate-500 font-medium mb-10 max-w-lg leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 w-full border-y border-border py-6">
            <span className={`text-lg font-bold ${!isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>Mensal</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-20 h-10 bg-slate-200 rounded-full relative flex items-center p-1 cursor-pointer transition-colors border-2 border-slate-300"
            >
              <div className={`w-8 h-8 bg-primary rounded-full transition-transform duration-300 shadow-sm ${isAnnual ? 'translate-x-10' : 'translate-x-0'}`} />
            </button>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>Anual</span>
              <span className="bg-green-100 text-green-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Ganhe 2 meses grátis!
              </span>
            </div>
          </div>
          
          <button 
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-primary hover:bg-primary-hover text-slate-900 text-2xl font-black px-12 py-6 rounded-[2rem] transition-all shadow-md hover:shadow-lg border-2 border-primary w-full md:w-auto hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? 'Redirecionando...' : `Fazer Upgrade - R$ ${isAnnual ? '299,00/ano' : '29,90/mês'}`}
          </button>
        </div>

      </div>
    </div>
  );
}
