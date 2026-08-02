'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Store, Phone, User, Percent, ArrowRight } from 'lucide-react';
import { useTenant } from '@/lib/TenantProvider';
import Paywall from '@/components/Paywall';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { revalidatePathCache } from '@/app/actions/cache';
import toast from 'react-hot-toast';

export type StoreType = {
  id: string; // firestore document id
  name: string;
  manager: string;
  phone: string;
  commissionPercent: number;
};

export default function ConsignacoesPage() {
  const { canAccessPDV } = useTenant();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', manager: '', phone: '', commissionPercent: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canAccessPDV) return;
    
    const fetchStores = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const q = query(collection(db, 'partnerStores'), where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            const data: StoreType[] = [];
            snapshot.forEach(doc => {
              const docData = doc.data();
              data.push({
                id: doc.id,
                name: docData.name,
                manager: docData.manager,
                phone: docData.phone,
                commissionPercent: docData.commissionPercent
              });
            });
            setStores(data);
          } catch (error) {
            console.error('Erro ao buscar lojas:', error);
            toast.error('Erro ao buscar lojas da nuvem.');
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      });
      return () => unsubscribe();
    };
    fetchStores();
  }, [canAccessPDV]);

  const handleAddStore = async () => {
    if (!newStore.name || !newStore.commissionPercent) return alert('Preencha o nome e a comissão da loja.');
    const user = auth.currentUser;
    if (!user) return toast.error('Precisa estar logado para criar loja.');

    setSaving(true);
    try {
      const storeData = {
        userId: user.uid,
        name: newStore.name,
        manager: newStore.manager,
        phone: newStore.phone,
        commissionPercent: Number(newStore.commissionPercent),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'partnerStores'), storeData);
      
      const store: StoreType = {
        id: docRef.id,
        name: storeData.name,
        manager: storeData.manager,
        phone: storeData.phone,
        commissionPercent: storeData.commissionPercent
      };

      setStores([...stores, store]);
      setNewStore({ name: '', manager: '', phone: '', commissionPercent: '' });
      setIsModalOpen(false);
      toast.success('Loja salva na nuvem com sucesso!');
      await revalidatePathCache('/consignacoes');
    } catch (error) {
      console.error('Erro ao salvar loja:', error);
      toast.error('Erro ao gravar loja no banco de dados. Verifique a conexão.');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccessPDV) {
    return <Paywall title="Consignação Premium" description="Faça o upgrade para o Plano Profissional para gerenciar lojas parceiras e itens em consignação." />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground">Lojas e Consignação</h1>
          <p className="text-xl text-foreground/70 font-medium mt-2">Faça a gestão dos seus pontos de venda e peças consignadas.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg border-2 border-[#FFAA00] flex items-center gap-2"
        >
          <Plus size={28} /> Nova Loja
        </button>
      </header>

      {stores.length === 0 ? (
        <div className="w-full text-center p-16 border-4 border-dashed border-[#FFAA00]/20 rounded-[2rem] bg-[#FDFBF7] flex flex-col items-center justify-center">
          <Store size={64} className="text-foreground/30 mb-4" />
          <h2 className="text-3xl font-black text-foreground mb-3">Nenhuma loja parceira cadastrada.</h2>
          <p className="text-xl text-foreground/70 font-medium max-w-lg mb-8">Adicione os pontos de venda onde suas peças estão expostas para controlar seu estoque externo.</p>
          <button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg inline-flex items-center gap-2">
            <Plus size={28} /> Nova Loja
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map(store => (
            <div key={store.id} className="bg-surface rounded-[2rem] p-8 shadow-sm border-4 border-border flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-[#B24020]">
                    <Store size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground flex-1">{store.name}</h3>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                    <User size={24} className="text-slate-400" />
                    <span>{store.manager || 'Responsável não informado'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                    <Phone size={24} className="text-slate-400" />
                    <span>{store.phone || 'Telefone não informado'}</span>
                  </div>
                  <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-border mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Comissão da Loja</span>
                    <div className="flex items-center gap-1 text-2xl font-black text-foreground">
                      {store.commissionPercent} <Percent size={20} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              <Link 
                href={`/consignacoes/${store.id}`}
                className="w-full py-4 bg-secondary/5 hover:bg-secondary/10 text-foreground font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg"
              >
                Acessar Mostruário <ArrowRight size={20} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVA LOJA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-[2rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 border-2 border-border">
            <h3 className="text-3xl font-black text-foreground mb-8">Cadastrar Nova Loja</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-bold text-foreground mb-3">Nome da Loja</label>
                <input 
                  type="text" 
                  value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})}
                  placeholder="Ex: Boutique Centro" 
                  className="w-full text-xl p-4 border-2 border-border rounded-2xl font-medium focus:border-primary focus:ring-4 focus:ring-[#FFAA00]/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xl font-bold text-foreground mb-3">Nome do Responsável</label>
                <input 
                  type="text" 
                  value={newStore.manager} onChange={e => setNewStore({...newStore, manager: e.target.value})}
                  placeholder="Ex: Carla Alves" 
                  className="w-full text-xl p-4 border-2 border-border rounded-2xl font-medium focus:border-primary focus:ring-4 focus:ring-[#FFAA00]/20 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xl font-bold text-foreground mb-3">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    value={newStore.phone} onChange={e => setNewStore({...newStore, phone: e.target.value})}
                    placeholder="(00) 00000-0000" 
                    className="w-full text-xl p-4 border-2 border-border rounded-2xl font-medium focus:border-primary focus:ring-4 focus:ring-[#FFAA00]/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xl font-bold text-foreground mb-3">Taxa da Loja (%)</label>
                  <input 
                    type="number" 
                    value={newStore.commissionPercent} onChange={e => setNewStore({...newStore, commissionPercent: e.target.value})}
                    placeholder="Ex: 20" 
                    className="w-full text-xl p-4 border-2 border-border rounded-2xl font-medium focus:border-primary focus:ring-4 focus:ring-[#FFAA00]/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-bold py-4 rounded-2xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddStore}
                className="flex-[2] bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 rounded-2xl transition-colors shadow-sm"
              >
                Salvar Loja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
