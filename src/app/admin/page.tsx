'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Users, Crown, Activity, ShoppingBag, Loader2, ArrowUpCircle, ArrowDownCircle, DollarSign, CalendarPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';

type UserData = {
  id: string;
  email: string;
  plan: string;
  createdAt: string;
  lastLogin?: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Metrics state
  const [totalUsers, setTotalUsers] = useState(0);
  const [proUsers, setProUsers] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [newSignups, setNewSignups] = useState(0);

  const STANDARD_PRO_PRICE = 29.90; // Exemplo de mensalidade

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user || user.email !== 'davidossantosrochadesouza@gmail.com') {
        router.push('/');
        return;
      }

      try {
        await fetchUsersData();
      } catch (error) {
        console.error('Erro ao buscar dados dos usuários:', error);
        toast.error('Erro ao carregar dados. Verifique suas permissões no Firestore.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUsersData = async () => {
    if (!auth.currentUser) return;

    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const loadedUsers: UserData[] = [];
    let proCount = 0;
    let recentSignupsCount = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const userData: UserData = {
        id: docSnap.id,
        email: data.email || 'Sem e-mail',
        plan: data.planType || data.plan || 'free',
        createdAt: data.createdAt || new Date().toISOString(),
        lastLogin: data.lastLogin
      };
      
      loadedUsers.push(userData);

      if (userData.plan?.toLowerCase() === 'pro') {
        proCount++;
      }

      const createdDate = new Date(userData.createdAt);
      if (createdDate >= thirtyDaysAgo) {
        recentSignupsCount++;
      }
    });
    
    loadedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setUsers(loadedUsers);
    setTotalUsers(loadedUsers.length);
    setProUsers(proCount);
    setMrr(proCount * STANDARD_PRO_PRICE);
    setNewSignups(recentSignupsCount);
  };

  const handleTogglePlan = async (userId: string, currentPlan: string) => {
    const isCurrentlyPro = currentPlan?.toLowerCase() === 'pro';
    const newPlan = isCurrentlyPro ? 'free' : 'pro';
    
    // Optimistic UI update
    setUsers(prev => 
      prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u)
    );

    // Update metrics optimistically
    if (newPlan === 'pro') {
      setProUsers(prev => prev + 1);
      setMrr(prev => prev + STANDARD_PRO_PRICE);
    } else {
      setProUsers(prev => prev - 1);
      setMrr(prev => prev - STANDARD_PRO_PRICE);
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, plan: newPlan })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Falha na requisição (${response.status})`);
      }
      const res = await response.json();
      
      if (!res.success) {
        throw new Error(res.error || 'Erro na API');
      }
      toast.success(`Plano atualizado para ${newPlan.toUpperCase()} com sucesso!`);
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao atualizar plano: ' + error.message);
      
      // Revert UI on failure
      const revertedPlan = currentPlan;
      setUsers(prev => 
        prev.map(u => u.id === userId ? { ...u, plan: revertedPlan } : u)
      );
      if (revertedPlan?.toLowerCase() === 'pro') {
        setProUsers(prev => prev + 1);
        setMrr(prev => prev + STANDARD_PRO_PRICE);
      } else {
        setProUsers(prev => prev - 1);
        setMrr(prev => prev - STANDARD_PRO_PRICE);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center bg-surface p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Crown className="text-primary" size={32} /> Painel de Comando AtelIA
            </h1>
            <p className="text-slate-500 font-medium mt-1">Gestão de Assinaturas e Usuários</p>
          </div>
        </header>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total de Usuários */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <h3 className="text-slate-600 font-bold">Total de Usuários</h3>
            </div>
            <span className="text-4xl font-black text-slate-900">{totalUsers}</span>
            <p className="mt-4 text-sm text-slate-500 font-medium">Cadastrados na plataforma</p>
          </div>

          {/* Usuários Ativos PRO */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Crown size={24} />
              </div>
              <h3 className="text-slate-600 font-bold">Usuários Ativos (PRO)</h3>
            </div>
            <span className="text-4xl font-black text-slate-900">{proUsers}</span>
            <p className="mt-4 text-sm text-slate-500 font-medium">
              Representam {totalUsers > 0 ? Math.round((proUsers / totalUsers) * 100) : 0}% da base
            </p>
          </div>

          {/* MRR */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign size={24} />
              </div>
              <h3 className="text-slate-600 font-bold">MRR Estimado</h3>
            </div>
            <span className="text-4xl font-black text-slate-900">
              R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <p className="mt-4 text-sm text-slate-500 font-medium">Receita recorrente mensal</p>
          </div>

          {/* Novos Cadastros */}
          <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <CalendarPlus size={24} />
              </div>
              <h3 className="text-slate-600 font-bold">Novos Cadastros</h3>
            </div>
            <span className="text-4xl font-black text-slate-900">{newSignups}</span>
            <p className="mt-4 text-sm text-slate-500 font-medium">Nos últimos 30 dias</p>
          </div>
        </div>

        {/* Gráfico / Crescimento Simples (Usando Tailwind) */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
          <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="text-emerald-500" /> Últimos 5 Cadastros Recentes
          </h2>
          <div className="space-y-4">
            {users.slice(0, 5).map((user, index) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{user.email}</p>
                    <p className="text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${user.plan?.toLowerCase() === 'pro' ? 'bg-primary/20 text-[#B24020]' : 'bg-slate-200 text-slate-600'}`}>
                    {user.plan}
                  </span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-slate-500 font-medium text-center py-4">Nenhum cadastro encontrado.</p>
            )}
          </div>
        </div>

        {/* Gestão Completa de Usuários (Tabela) */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-900">Gestão de Usuários</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold">
              {users.length} Registros
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="py-4 px-6 font-bold text-slate-500 text-sm uppercase">E-mail do Usuário</th>
                  <th className="py-4 px-6 font-bold text-slate-500 text-sm uppercase">Data de Cadastro</th>
                  <th className="py-4 px-6 font-bold text-slate-500 text-sm uppercase">Status do Plano</th>
                  <th className="py-4 px-6 font-bold text-slate-500 text-sm uppercase text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-background/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-slate-700">{u.email}</td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${u.plan?.toLowerCase() === 'pro' ? 'bg-primary/20 text-[#B24020]' : 'bg-slate-100 text-slate-600'}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {u.plan?.toLowerCase() === 'pro' ? (
                        <button 
                          onClick={() => handleTogglePlan(u.id, u.plan)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                        >
                          <ArrowDownCircle size={16} /> Rebaixar para Free
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleTogglePlan(u.id, u.plan)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-[#2A4A7F] text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                        >
                          <ArrowUpCircle size={16} className="text-primary" /> Fazer Upgrade PRO
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">Nenhum usuário cadastrado na base de dados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
