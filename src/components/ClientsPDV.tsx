'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import { Upload, Lock, FileText, CheckCircle2, AtSign, Phone, MapPin, CreditCard, Store, Percent, Package, Gift, User, Trash2, Loader2, X, MessageCircle, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Paywall from '@/components/Paywall';
import LimitModal from '@/components/LimitModal';
import { auth } from '@/lib/firebase';
import { 
  fetchClients, fetchPointsOfSale, addClient, addPointOfSale, 
  deleteClient, deletePointOfSale
} from '@/app/actions/clientes';
import type { Client, PointOfSale } from '@/app/actions/clientes';

export default function ClientsPDV() {
  const { canAccessPDV, userId } = useTenant();
  const [activeTab, setActiveTab] = useState<'clientes' | 'pdv'>('clientes');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', birthday: '' });
  
  // Modal Novo PDV
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [newPos, setNewPos] = useState({ name: '', commissionPercent: 0 });

  const [saving, setSaving] = useState(false);

  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitItemName, setLimitItemName] = useState('');

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    const [fetchedClients, fetchedPos] = await Promise.all([
      fetchClients(userId),
      fetchPointsOfSale(userId)
    ]);
    setClients(fetchedClients);
    setPointsOfSale(fetchedPos);
    setLoading(false);
  };

  const openWhatsApp = (client: Client) => {
    const number = client.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${number}`, '_blank');
  };

  const handleVerEstoque = (pos: PointOfSale) => {
    alert(`Em breve: Listagem de itens em consignação na loja "${pos.name}".`);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const clientData = { ...newClient, userId };
    const res = await addClient(clientData);
    if (res.success) {
      setIsClientModalOpen(false);
      setNewClient({ name: '', phone: '', birthday: '' });
      toast.success('Cliente registrado!');
      await loadData();
    } else {
      if (res.error === 'LIMIT_REACHED_CLIENTS') {
        setIsClientModalOpen(false);
        setLimitItemName('Clientes');
        setLimitModalOpen(true);
      } else {
        console.error("Erro detalhado:", res.error);
        toast.error(res.error || 'Falha ao registrar cliente.');
      }
    }
    setSaving(false);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      setLoading(true);
      const res = await deleteClient(clientId);
      if (res.success) {
        toast.success('Cliente removido.');
        await loadData();
      } else {
        console.error("Erro detalhado:", res.error);
        toast.error(res.error || 'Erro ao excluir o cliente.');
        setLoading(false);
      }
    }
  };

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const posData = { ...newPos, userId };
    const res = await addPointOfSale(posData);
    if (res.success) {
      setIsPosModalOpen(false);
      setNewPos({ name: '', commissionPercent: 0 });
      toast.success('Loja parceira registrada!');
      await loadData();
    } else {
      if (res.error === 'LIMIT_REACHED_STORES') {
        setIsPosModalOpen(false);
        setLimitItemName('Lojas Parceiras');
        setLimitModalOpen(true);
      } else {
        console.error("Erro detalhado:", res.error);
        toast.error(res.error || 'Falha ao registrar loja.');
      }
    }
    setSaving(false);
  };

  const handleDeletePos = async (posId: string) => {
    if (confirm('Tem certeza que deseja excluir este Ponto de Venda?')) {
      setLoading(true);
      const res = await deletePointOfSale(posId);
      if (res.success) {
        toast.success('Loja parceira removida.');
        await loadData();
      } else {
        console.error("Erro detalhado:", res.error);
        toast.error(res.error || 'Erro ao excluir a loja.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="w-full relative">
      {loading && (
        <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-foreground" size={48} />
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-secondary">Clientes e Consignação</h1>
        <p className="text-xl text-slate-600 mt-2">Faça a gestão dos/as seus/suas clientes e acompanhe as suas peças em pontos de venda.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-2 rounded-2xl mb-8 w-full max-w-md">
        <button
          onClick={() => setActiveTab('clientes')}
          className={`flex-1 py-4 text-xl font-bold rounded-xl transition-all ${
            activeTab === 'clientes' 
              ? 'bg-surface text-secondary shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Lista de Clientes
        </button>
        <button
          onClick={() => setActiveTab('pdv')}
          className={`flex-1 py-4 text-xl font-bold rounded-xl transition-all ${
            activeTab === 'pdv' 
              ? 'bg-surface text-secondary shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Pontos de Venda
        </button>
      </div>

      {/* TAB 1: CLIENTES */}
      {activeTab === 'clientes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-secondary">Meus/Minhas Clientes</h2>
            <button onClick={() => setIsClientModalOpen(true)} className="bg-primary hover:bg-primary-hover text-slate-900 text-lg font-bold py-3 px-6 rounded-2xl transition-colors shadow-sm border-2 border-primary flex items-center gap-2">
              <Plus size={24} /> Novo/a Cliente
            </button>
          </div>

          {clients.length === 0 ? (
            <div className="w-full text-center p-16 border-4 border-dashed border-[#FFAA00]/20 rounded-[2rem] bg-[#FDFBF7] flex flex-col items-center justify-center">
              <User size={64} className="text-foreground/30 mb-4" />
              <h2 className="text-3xl font-black text-foreground mb-3">Sua lista de clientes está vazia.</h2>
              <p className="text-xl text-foreground/70 font-medium max-w-lg mb-8">Adicione sua primeira cliente para começar a gerar orçamentos personalizados!</p>
              <button onClick={() => setIsClientModalOpen(true)} className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg inline-flex items-center gap-2">
                <Plus size={28} /> Novo Cliente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map(client => (
                <div key={client.id} className="bg-surface rounded-[2rem] p-8 shadow-sm border-4 border-border flex flex-col justify-between hover:shadow-md transition-shadow relative">
                  <button 
                    onClick={() => handleDeleteClient(client.id)}
                    className="absolute top-6 right-6 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors"
                    title="Excluir Cliente"
                  >
                    <Trash2 size={20} />
                  </button>
                  
                  <div>
                    <div className="flex items-center gap-4 mb-6 pr-10">
                      <div className="w-16 h-16 bg-secondary-light rounded-full flex items-center justify-center text-secondary shrink-0">
                        <User size={32} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900 leading-tight">{client.name}</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                        <Phone size={24} className="text-slate-400" />
                        <span>{client.phone || 'Sem telefone'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                        <Gift size={24} className="text-slate-400" />
                        <span>Aniversário: <span className="font-bold text-slate-900">{client.birthday || 'N/A'}</span></span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => openWhatsApp(client)}
                    className="w-full py-4 bg-green-50 hover:bg-green-100 text-green-700 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border-2 border-green-200 text-lg"
                  >
                    <MessageCircle size={24} /> Chamar no WhatsApp
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PONTOS DE VENDA */}
      {activeTab === 'pdv' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!canAccessPDV ? (
            <Paywall title="Consignação Premium" description="Faça o upgrade para o Plano Profissional para gerenciar seus pontos de venda e itens em consignação." />
          ) : (
            <>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-secondary">Lojas e Consignação</h2>
                <button onClick={() => setIsPosModalOpen(true)} className="bg-primary hover:bg-primary-hover text-slate-900 text-lg font-bold py-3 px-6 rounded-2xl transition-colors shadow-sm border-2 border-primary flex items-center gap-2">
                  <Plus size={24} /> Novo Ponto de Venda
                </button>
              </div>

              {pointsOfSale.length === 0 ? (
                <div className="w-full text-center p-16 border-4 border-dashed border-[#FFAA00]/20 rounded-[2rem] bg-[#FDFBF7] flex flex-col items-center justify-center">
                  <Store size={64} className="text-foreground/30 mb-4" />
                  <h2 className="text-3xl font-black text-foreground mb-3">Nenhuma loja parceira cadastrada.</h2>
                  <p className="text-xl text-foreground/70 font-medium max-w-lg mb-8">Adicione os pontos de venda onde suas peças estão expostas para controlar seu estoque externo.</p>
                  <button onClick={() => setIsPosModalOpen(true)} className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg inline-flex items-center gap-2">
                    <Plus size={28} /> Nova Loja
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pointsOfSale.map(pos => (
                    <div key={pos.id} className="bg-surface rounded-[2rem] p-8 shadow-sm border-4 border-border flex flex-col justify-between hover:shadow-md transition-shadow relative">
                      <button 
                        onClick={() => handleDeletePos(pos.id)}
                        className="absolute top-6 right-6 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors"
                        title="Excluir Loja"
                      >
                        <Trash2 size={20} />
                      </button>

                      <div>
                        <div className="flex items-center gap-4 mb-6 pr-10">
                          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 shrink-0">
                            <Store size={32} />
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 flex-1 leading-tight">{pos.name}</h3>
                        </div>
                        
                        <div className="bg-background rounded-2xl p-6 border-2 border-border mb-8">
                          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Comissão da Loja</p>
                          <div className="flex items-center gap-2 text-3xl font-black text-secondary">
                            {pos.commissionPercent} <Percent size={28} className="text-slate-400" />
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleVerEstoque(pos)}
                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 border-2 border-border text-lg"
                      >
                        <Package size={24} /> Ver Estoque na Loja
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Novo Cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-foreground">Novo Cliente</h2>
                <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome</label>
                  <input required type="text" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">WhatsApp</label>
                  <input type="text" placeholder="(11) 99999-9999" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Data de Aniversário</label>
                  <input type="text" placeholder="DD/MM" value={newClient.birthday} onChange={e => setNewClient({...newClient, birthday: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-secondary text-white font-bold rounded-xl flex justify-center">{saving ? <Loader2 className="animate-spin" size={24} /> : 'Salvar Cliente'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Loja (PDV) */}
      {isPosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-foreground">Novo Ponto de Venda</h2>
                <button onClick={() => setIsPosModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreatePos} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Loja</label>
                  <input required type="text" value={newPos.name} onChange={e => setNewPos({...newPos, name: e.target.value})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Comissão Cobrada (%)</label>
                  <input required type="number" min="0" max="100" value={newPos.commissionPercent} onChange={e => setNewPos({...newPos, commissionPercent: Number(e.target.value)})} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsPosModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-secondary text-white font-bold rounded-xl flex justify-center">{saving ? <Loader2 className="animate-spin" size={24} /> : 'Salvar Loja'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <LimitModal 
        isOpen={limitModalOpen} 
        onClose={() => setLimitModalOpen(false)} 
        itemName={limitItemName} 
      />
    </div>
  );
}
