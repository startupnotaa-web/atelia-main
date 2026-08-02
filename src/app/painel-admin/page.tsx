'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Shield, User, Loader2, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

type AppUser = {
  id: string;
  email: string;
  plan: string;
  name?: string;
};

export default function PainelAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        console.log('Role do usuário logado:', userData?.role);
        
        if (userData?.role !== 'admin' && userData?.isAdmin !== true) {
          toast.error('Acesso negado.');
          router.push('/');
          return;
        }
        
        fetchUsers();
      } catch (err) {
        console.error('Erro ao verificar permissões:', err);
        setError('Não foi possível verificar suas permissões.');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    try {
      if (!auth.currentUser) return;
      setError(null);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: AppUser[] = usersSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as AppUser));

      setUsers(usersData);
    } catch (error: any) {
      console.error('Erro ao buscar usuários (Client SDK):', error);
      setError(error.message || 'Não foi possível carregar a lista de usuários via Client SDK. Verifique se você possui permissões de administrador.');
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada no Firestore. Verifique as regras de segurança.');
      } else {
        toast.error(error.message || 'Erro ao carregar usuários.');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePlan = async (userId: string, currentPlan: string) => {
    const isCurrentlyPro = currentPlan?.toLowerCase() === 'pro';
    const newPlan = isCurrentlyPro ? 'free' : 'pro';
    
    if (!confirm(`Deseja alterar o plano deste usuário para ${newPlan.toUpperCase()}?`)) return;
    
    setActionLoading(userId);
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
      toast.success(`Plano atualizado para ${newPlan.toUpperCase()}!`);
      // Atualiza a lista localmente
      setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
    } catch (error: any) {
      console.error('Erro ao atualizar plano:', error);
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada no Firebase.');
      } else {
        toast.error(error.message || 'Falha ao atualizar plano.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncUsers = async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    setSyncing(true);
    try {
      const response = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Falha na requisição (${response.status})`);
      }
      const res = await response.json();
      
      if (res.success) {
        toast.success(`${res.syncedCount} novos usuários sincronizados!`);
        fetchUsers();
      } else {
        toast.error(res.error || 'Erro ao sincronizar usuários.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro de conexão ao sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 font-medium text-lg">Validando credenciais...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-lg shadow-sm border border-red-100">
          <Shield size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2">Acesso Restrito ou Falha</h2>
          <p className="font-medium text-red-700 break-words">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-slate-900 p-3 rounded-xl text-white shadow-md">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Controle de Acesso</h1>
            <p className="text-slate-500 font-medium">Painel Administrativo Direto (Client-Side)</p>
          </div>
        </div>
        
        <div className="flex justify-end mb-6">
          <button 
            onClick={handleSyncUsers}
            disabled={syncing}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            Sincronizar Auth {'>'} Firestore
          </button>
        </div>

        <div className="bg-surface border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Usuário</th>
                  <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider">UID</th>
                  <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Plano Atual</th>
                  <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider text-right">Ação Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-background transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-full text-slate-400">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{user.email}</p>
                          {user.name && <p className="text-xs text-slate-500 mt-0.5">{user.name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <code className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">{user.id}</code>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        user.plan?.toLowerCase() === 'pro' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.plan?.toLowerCase() === 'pro' ? 'PRO' : 'FREE'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <button
                        onClick={() => togglePlan(user.id, user.plan || 'free')}
                        disabled={actionLoading === user.id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 ${
                          user.plan?.toLowerCase() === 'pro'
                            ? 'bg-surface border-2 border-border text-slate-600 hover:bg-background'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : user.plan?.toLowerCase() === 'pro' ? (
                          <><ArrowDownCircle size={16} /> Rebaixar</>
                        ) : (
                          <><ArrowUpCircle size={16} /> Tornar PRO</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-500 font-medium">
                      Nenhum usuário encontrado na base de dados.
                    </td>
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
