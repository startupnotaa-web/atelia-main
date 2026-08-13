'use client';

import React, { useState, useEffect } from 'react';
import {
  PackageCheck, Plus, Search,
  X, Loader2, Minus, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';

import { EstoqueProntoItem } from '@/lib/erpTypes';

interface CatalogoItem {
  id: string;
  nome: string;
  precoFinal: number;
  /** Custo de produção calculado pela Calculadora — segue junto até a venda para rastrear lucro líquido. */
  custoBase: number;
}

export default function ProntaEntregaPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [estoquePronto, setEstoquePronto] = useState<EstoqueProntoItem[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<EstoqueProntoItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Form State
  const [formProdutoId, setFormProdutoId] = useState('');
  const [formQuantidade, setFormQuantidade] = useState<number | string>(1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadRealtimeData(currentUser.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadRealtimeData = (userId: string) => {
    // Estoque Pronto
    const qPronto = query(collection(db, 'estoque_pronto'), where('userId', '==', userId));
    const unsubPronto = onSnapshot(qPronto, (snap) => {
      const p: EstoqueProntoItem[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        p.push({
          id: docSnap.id,
          produtoId: d.produtoId,
          nome: d.nome || 'Produto',
          precoVenda: parseFloat(d.precoVenda || 0),
          custoUnitario: parseFloat(d.custoUnitario || 0),
          quantidadeDisponivel: parseInt(d.quantidadeDisponivel || 0),
          esgotado: d.esgotado === true,
          userId: d.userId
        });
      });
      setEstoquePronto(p);
      setLoading(false);
    });

    // Catálogo
    const qCatalogo = query(collection(db, 'catalogo'), where('userId', '==', userId));
    const unsubCatalogo = onSnapshot(qCatalogo, (snap) => {
      const cat: CatalogoItem[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        cat.push({
          id: docSnap.id,
          nome: d.nome || d.name || 'Sem Nome',
          precoFinal: parseFloat(d.precoFinal || d.preco || d.price || 0),
          custoBase: parseFloat(d.custoBase || d.custo || 0)
        });
      });
      setCatalogo(cat);
    });

    return () => {
      unsubPronto();
      unsubCatalogo();
    };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSavePrateleira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formProdutoId) {
      toast.error('Selecione um produto do catálogo.');
      return;
    }

    const qtd = parseInt(formQuantidade.toString());
    if (isNaN(qtd) || qtd <= 0) {
      toast.error('Quantidade deve ser maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const prod = catalogo.find(c => c.id === formProdutoId);
      
      // Verifica se já existe na prateleira
      const itemExistente = estoquePronto.find(i => i.produtoId === formProdutoId);
      
      if (itemExistente) {
        // Atualiza quantidade e aproveita para atualizar o custo unitário
        // (itens antigos na prateleira podem não ter o custo gravado).
        await updateDoc(doc(db, 'estoque_pronto', itemExistente.id), {
          quantidadeDisponivel: increment(qtd),
          custoUnitario: prod?.custoBase || 0,
          esgotado: false
        });
      } else {
        // Cria novo registro carregando o custo de produção da Calculadora,
        // para a Venda de Balcão registrar lucro líquido real (não só faturamento).
        await addDoc(collection(db, 'estoque_pronto'), {
          userId: user.uid,
          produtoId: formProdutoId,
          nome: prod?.nome || 'Produto',
          precoVenda: prod?.precoFinal || 0,
          custoUnitario: prod?.custoBase || 0,
          quantidadeDisponivel: qtd,
          esgotado: false,
          createdAt: serverTimestamp()
        });
      }
      
      toast.success('Produto adicionado à prateleira!');
      setIsModalOpen(false);
      setFormProdutoId('');
      setFormQuantidade(1);

    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar no estoque.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !itemToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'estoque_pronto', itemToDelete.id));
      toast.success(`"${itemToDelete.nome}" removido da prateleira.`);
      setItemToDelete(null);
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'permission-denied') {
        toast.error('Sem permissão para excluir este item.');
      } else {
        toast.error('Erro ao excluir. Tente novamente.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const adjustQuantity = async (itemId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty < 0) return;
    try {
      await updateDoc(doc(db, 'estoque_pronto', itemId), {
        quantidadeDisponivel: newQty
      });
    } catch (e) {
      toast.error('Erro ao atualizar quantidade.');
    }
  };

  const filteredItems = estoquePronto.filter(i => 
    (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-foreground" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Pronta-Entrega</h1>
          <p className="text-success mt-1 font-bold">Gerencie suas peças finalizadas para venda imediata</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar na prateleira..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-3 bg-surface border-2 border-border rounded-xl focus:outline-none focus:border-primary font-medium text-slate-700 shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-[#FFAA00]/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Adicionar à Prateleira
          </button>
        </div>
      </header>

      {/* Grid de Vitrine */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
        {filteredItems.map(item => (
          <div key={item.id} className={`bg-surface rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col ${item.quantidadeDisponivel === 0 ? 'border-red-200 opacity-60 grayscale' : 'border-border hover:shadow-md hover:border-[#FFAA00]/50'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-secondary/5 p-3 rounded-xl text-foreground">
                <PackageCheck size={28} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${item.quantidadeDisponivel > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {item.quantidadeDisponivel > 0 ? 'Em Estoque' : 'Esgotado'}
                </div>
                <button
                  onClick={() => setItemToDelete(item)}
                  title="Excluir da prateleira"
                  className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{item.nome}</h3>
            <p className="text-2xl font-black text-success mb-6">{formatCurrency(item.precoVenda)}</p>
            
            <div className="mt-auto pt-4 border-t-2 border-border flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Quantidade</span>
              <div className="flex items-center gap-3 bg-background rounded-xl border border-border p-1">
                <button 
                  onClick={() => adjustQuantity(item.id, item.quantidadeDisponivel, -1)}
                  disabled={item.quantidadeDisponivel === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface text-slate-600 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Minus size={16} />
                </button>
                <span className={`w-6 text-center font-black ${item.quantidadeDisponivel === 0 ? 'text-red-500' : 'text-foreground'}`}>
                  {item.quantidadeDisponivel}
                </span>
                <button 
                  onClick={() => adjustQuantity(item.id, item.quantidadeDisponivel, 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface text-slate-600 hover:bg-emerald-50 hover:text-emerald-500 transition-colors shadow-sm"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-surface rounded-3xl border-2 border-dashed border-border">
            <PackageCheck size={64} className="mb-4 text-slate-300" />
            <h3 className="text-2xl font-black text-slate-500 mb-2">Prateleira Vazia</h3>
            <p className="text-slate-500 font-medium">Você ainda não adicionou peças de pronta-entrega.</p>
          </div>
        )}
      </div>

      {/* Modal Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200 border-2 border-border">
            <h3 className="text-2xl font-black text-red-600 mb-2">Excluir da Prateleira</h3>
            <p className="text-slate-600 font-medium mb-2">
              Tem certeza que deseja excluir <strong className="text-slate-900">{itemToDelete.nome}</strong> da pronta-entrega?
            </p>
            <p className="text-sm text-slate-500 font-medium mb-6">
              O produto continua no seu catálogo — apenas as {itemToDelete.quantidadeDisponivel} unidades da prateleira serão removidas. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={deleting}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-foreground">Prateleira</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSavePrateleira} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Produto (Catálogo)</label>
                  <select required value={formProdutoId} onChange={e => setFormProdutoId(e.target.value)} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium">
                    <option value="" disabled>Selecione a peça pronta...</option>
                    {catalogo.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} - {formatCurrency(c.precoFinal)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Apenas peças já cadastradas no catálogo podem ir para a prateleira.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Quantidade Disponível</label>
                  <input required type="number" step="1" min="1" value={formQuantidade} onChange={e => setFormQuantidade(e.target.value)} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-bold text-slate-800" />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    Adicionar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
