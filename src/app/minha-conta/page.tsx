'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Key } from 'lucide-react';

export default function MinhaContaPage() {
  const router = useRouter();
  
  const [userData, setUserData] = useState({ name: 'Artesã', email: 'contato@atelie.com' });

  useEffect(() => {
    // Busca dados do usuário (na versão final, será substituído por chamadas de auth do Firebase)
    const activeTenantId = localStorage.getItem('@artesas/active_tenant');
    const mockTenantsStr = localStorage.getItem('mockTenants');
    if (activeTenantId && mockTenantsStr) {
      const tenants = JSON.parse(mockTenantsStr);
      const found = tenants.find((t: any) => t.id === activeTenantId);
      if (found) {
        setUserData({ name: found.name, email: found.email });
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('@artesas/active_tenant');
    router.push('/login');
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto w-full min-h-screen">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Gerenciamento de Conta</h1>
        <p className="text-xl text-slate-500 font-medium mt-2">Controle o seu perfil e as ferramentas do seu ateliê.</p>
      </div>

      <div className="bg-surface border-2 border-border rounded-3xl p-8 md:p-10 shadow-sm max-w-2xl">
        <div className="flex items-center gap-6 mb-10">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            <User size={48} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">{userData.name}</h2>
            <p className="text-lg text-slate-500">{userData.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <button className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-border hover:border-slate-300 hover:bg-background transition-colors text-left group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-surface transition-colors">
                <Key size={24} className="text-slate-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Redefinir Senha</h3>
                <p className="text-slate-500 font-medium">Enviaremos um link para o seu e-mail.</p>
              </div>
            </div>
          </button>

          <button onClick={handleLogout} className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-red-100 hover:border-red-200 hover:bg-red-50 transition-colors text-left group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100/50 rounded-xl group-hover:bg-surface transition-colors">
                <LogOut size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-600 text-lg">Sair da Conta</h3>
                <p className="text-red-500/80 font-medium">Encerrar a sessão de forma segura.</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
