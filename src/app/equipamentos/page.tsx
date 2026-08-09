'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/TenantProvider';
import { Plus, Trash2, Settings, Lock } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Equipamento {
  id: string;
  nome: string;
  custoDesgaste: number;
}

export default function EquipamentosPage() {
  const router = useRouter();
  const { isPro } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [nome, setNome] = useState('');
  const [custo, setCusto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        toast.error('Por favor, faça login.');
        router.push('/login');
      } else {
        setUser(currentUser);
        await carregarEquipamentos(currentUser.uid);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const carregarEquipamentos = async (userId: string) => {
    try {
      const q = query(collection(db, 'equipamentos'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const items: Equipamento[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          nome: data.nome,
          custoDesgaste: data.custoDesgaste
        });
      });
      setEquipamentos(items);
    } catch (error) {
      console.error('Erro ao carregar equipamentos:', error);
      toast.error('Erro ao carregar dados.');
    }
  };

  const adicionarEquipamento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Regra de Negócio: Paywall para conta Free
    if (!isPro && equipamentos.length >= 2) {
      setShowUpgradeModal(true);
      return;
    }

    if (!nome.trim() || !custo) {
      toast.error('Preencha o nome e o custo de desgaste.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Salvando equipamento...');

    try {
      const novoEquipamento = {
        nome,
        custoDesgaste: parseFloat(custo),
        userId: user.uid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'equipamentos'), novoEquipamento);
      
      setEquipamentos([...equipamentos, { id: docRef.id, ...novoEquipamento }]);
      setNome('');
      setCusto('');
      toast.success('Equipamento salvo com sucesso!', { id: loadingToast });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar equipamento.', { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removerEquipamento = async (id: string) => {
    if (!confirm('Deseja realmente excluir este equipamento?')) return;
    
    const loadingToast = toast.loading('Excluindo...');
    try {
      await deleteDoc(doc(db, 'equipamentos', id));
      setEquipamentos(equipamentos.filter(eq => eq.id !== id));
      toast.success('Excluído com sucesso!', { id: loadingToast });
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir equipamento.', { id: loadingToast });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <Settings size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Equipamentos e Ferramentas</h1>
            <p className="text-slate-600 mt-1">
              Gerencie suas máquinas e calcule o desgaste delas nas suas peças.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Formulário de Adição */}
          <div className="md:col-span-1">
            <form onSubmit={adicionarEquipamento} className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Novo Equipamento</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Ferramenta</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Máquina de Costura"
                    className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custo de Desgaste (R$ por peça)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custo}
                    onChange={(e) => setCusto(e.target.value)}
                    placeholder="Ex: 0.50"
                    className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? 'Salvando...' : <><Plus size={18} /> Adicionar</>}
                </button>

                {!isPro && (
                  <p className="text-xs text-center text-slate-500 mt-3">
                    Plano Free: Limite de 2 equipamentos.
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Lista de Equipamentos */}
          <div className="md:col-span-2">
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Seus Equipamentos Salvos</h2>
              
              {equipamentos.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Settings size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Nenhum equipamento cadastrado ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {equipamentos.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                      <div>
                        <h3 className="font-medium text-slate-800">{eq.nome}</h3>
                        <p className="text-sm text-slate-500">
                          Desgaste por uso: {formatCurrency(eq.custoDesgaste)}
                        </p>
                      </div>
                      <button
                        onClick={() => removerEquipamento(eq.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir equipamento"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Upgrade */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-6">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 text-center mb-2">Limite Atingido</h3>
            <p className="text-slate-600 text-center mb-6">
              O plano Free permite cadastrar até 2 equipamentos. Para cadastrar ferramentas ilimitadas e calcular o desgaste completo do seu ateliê, assine o plano PRO.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => router.push('/perfil')}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-transform active:scale-95"
              >
                Fazer Upgrade para PRO
              </button>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
