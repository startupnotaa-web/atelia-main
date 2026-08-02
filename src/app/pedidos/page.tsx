'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Package, Plus, Search, 
  CheckCircle2, Clock, CreditCard, Factory, 
  X, Loader2, Trash2, ArrowRight, ArrowLeft,
  ShoppingBag, Truck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, writeBatch, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { forceRevalidateDashboard } from '@/app/actions/finance';

export type PaymentStatus = 'pendente' | 'sinal' | 'pago';
export type ProductionStatus = 'fila' | 'producao' | 'finalizado' | 'entregue';

interface Order {
  id: string;
  cliente: string; 
  clienteNome: string;
  produtoId: string;
  produtoNome: string;
  valorFinal: number;
  dataEntrega: string;
  statusPagamento: PaymentStatus;
  statusProducao: ProductionStatus;
  detalhesCalculo?: any;
  userId: string;
  createdAt: any;
}

interface Cliente {
  id: string;
  nome: string;
}

interface CatalogoItem {
  id: string;
  nome: string;
  precoFinal: number;
  detalhesCalculo?: any;
}

interface EstoqueItem {
  id: string;
  quantidadeAtual: number;
}

interface EstoqueProntoItem {
  id: string;
  produtoId: string;
  nome: string;
  precoVenda: number;
  quantidadeDisponivel: number;
}

export default function PedidosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [estoquePronto, setEstoquePronto] = useState<EstoqueProntoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formTipoVenda, setFormTipoVenda] = useState<'encomenda' | 'pronta_entrega'>('encomenda');
  const [formClienteId, setFormClienteId] = useState('');
  
  interface FormItem {
    id: string;
    produtoId: string;
    nome: string;
    quantidade: number;
    valorUnitario: number;
    detalhesCalculo: any;
    produtoOriginalId: string;
  }
  const [formItems, setFormItems] = useState<FormItem[]>([{ id: Date.now().toString(), produtoId: '', nome: '', quantidade: 1, valorUnitario: 0, detalhesCalculo: null, produtoOriginalId: '' }]);
  
  const [formDataEntrega, setFormDataEntrega] = useState('');
  const [formStatusPagamento, setFormStatusPagamento] = useState<PaymentStatus>('pendente');

  // Quick Entry Modal State
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickDate, setQuickDate] = useState('');
  const [quickTotal, setQuickTotal] = useState('');
  const [quickUnitValue, setQuickUnitValue] = useState('');
  const [quickClient, setQuickClient] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

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
    // Pedidos
    const qPedidos = query(collection(db, 'pedidos'), where('userId', '==', userId));
    const unsubPedidos = onSnapshot(qPedidos, (snap) => {
      const p: Order[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        p.push({
          id: docSnap.id,
          cliente: d.cliente || 'balcao',
          clienteNome: d.clienteNome || d.clientName || 'Cliente Balcão',
          produtoId: d.produtoId || '',
          produtoNome: d.produtoNome || d.produto || 'Produto Indefinido',
          valorFinal: parseFloat(d.valorFinal || d.totalValue || d.valor || 0),
          dataEntrega: d.dataEntrega || d.deadline || '',
          statusPagamento: d.statusPagamento || d.paymentStatus || 'pendente',
          statusProducao: d.statusProducao || d.productionStatus || 'fila',
          detalhesCalculo: d.detalhesCalculo || null,
          userId: d.userId,
          createdAt: d.createdAt
        });
      });
      // Sort: Mais novos primeiro
      p.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setOrders(p);
      setLoading(false);
    });

    // Clientes
    const qClientes = query(collection(db, 'clientes'), where('userId', '==', userId));
    const unsubClientes = onSnapshot(qClientes, (snap) => {
      const c: Cliente[] = [];
      snap.forEach(docSnap => {
        c.push({ id: docSnap.id, nome: docSnap.data().nome || docSnap.data().name || 'Sem Nome' });
      });
      setClientes(c);
    });

    // Catalogo
    const qCatalogo = query(collection(db, 'catalogo'), where('userId', '==', userId));
    const unsubCatalogo = onSnapshot(qCatalogo, (snap) => {
      const cat: CatalogoItem[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        cat.push({ 
          id: docSnap.id, 
          nome: d.nome || d.name || 'Sem Nome', 
          precoFinal: parseFloat(d.precoFinal || d.preco || d.price || 0),
          detalhesCalculo: d.detalhesCalculo || null
        });
      });
      setCatalogo(cat);
    });

    // Estoque
    const qEstoque = query(collection(db, 'estoque'), where('userId', '==', userId));
    const unsubEstoque = onSnapshot(qEstoque, (snap) => {
      const est: EstoqueItem[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        est.push({
          id: docSnap.id,
          quantidadeAtual: parseFloat(d.quantidadeTotal || d.quantidade || d.quantity || 0)
        });
      });
      setEstoque(est);
    });

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
          quantidadeDisponivel: parseInt(d.quantidadeDisponivel || 0)
        });
      });
      setEstoquePronto(p);
    });

    return () => {
      unsubPedidos();
      unsubClientes();
      unsubCatalogo();
      unsubEstoque();
      unsubPronto();
    };
  };

  const handleItemProdutoChange = (index: number, prodId: string) => {
    const newItems = [...formItems];
    const item = newItems[index];
    item.produtoId = prodId;
    
    if (formTipoVenda === 'encomenda') {
      const prod = catalogo.find(c => c.id === prodId);
      if (prod) {
        item.nome = prod.nome;
        item.valorUnitario = prod.precoFinal;
        item.detalhesCalculo = prod.detalhesCalculo;
        item.produtoOriginalId = prodId;
      }
    } else {
      const prod = estoquePronto.find(c => c.id === prodId);
      if (prod) {
        item.nome = prod.nome;
        item.valorUnitario = prod.precoVenda;
        item.produtoOriginalId = prod.produtoId;
      }
    }
    setFormItems(newItems);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (formItems.some(i => !i.produtoId || i.quantidade < 1)) {
      toast.error('Preencha os produtos e quantidades corretamente.');
      return;
    }

    setSaving(true);
    try {
      let clienteNome = 'Cliente Balcão';
      if (formClienteId && formClienteId !== 'balcao') {
        const cl = clientes.find(c => c.id === formClienteId);
        if (cl) clienteNome = cl.nome;
      }

      const formTotal = formItems.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0);

      const itemsToSave = formItems.map(item => ({
        id: item.produtoOriginalId,
        name: item.nome,
        quantity: item.quantidade,
        price: item.valorUnitario,
        detalhesCalculo: item.detalhesCalculo,
        produtoId: item.produtoId
      }));

      const produtoNomeTitle = formItems.length === 1 ? formItems[0].nome : `${formItems.length} itens`;

      const batch = writeBatch(db);
      
      // 1. Criar o pedido
      const newOrderRef = doc(collection(db, 'pedidos'));
      batch.set(newOrderRef, {
        userId: user.uid,
        cliente: formClienteId || 'balcao',
        clienteNome: clienteNome,
        produtoId: 'multiplos',
        produtoNome: produtoNomeTitle,
        valorFinal: formTotal,
        dataEntrega: formDataEntrega,
        statusPagamento: formTipoVenda === 'pronta_entrega' ? 'pago' : formStatusPagamento,
        statusProducao: 'fila', // Começa na fila
        items: itemsToSave,
        createdAt: serverTimestamp()
      });

      // 2. Baixa no Estoque (Agregada)
      if (formTipoVenda === 'encomenda') {
         const matAggregation: Record<string, number> = {};
         for (const item of formItems) {
            if (item.detalhesCalculo?.materiais && Array.isArray(item.detalhesCalculo.materiais)) {
              for (const mat of item.detalhesCalculo.materiais) {
                if (mat.isEstoque && mat.estoqueId) {
                   const qtyGasta = (parseFloat(mat.quantidade) || 0) * item.quantidade;
                   matAggregation[mat.estoqueId] = (matAggregation[mat.estoqueId] || 0) + qtyGasta;
                }
              }
            }
         }
         
         for (const [estoqueId, qtyToDeduct] of Object.entries(matAggregation)) {
            const estItem = estoque.find(e => e.id === estoqueId);
            if (estItem && qtyToDeduct > 0) {
               const estoqueRef = doc(db, 'estoque', estoqueId);
               batch.update(estoqueRef, {
                 quantidadeTotal: estItem.quantidadeAtual - qtyToDeduct,
                 quantidade: estItem.quantidadeAtual - qtyToDeduct,
                 quantity: estItem.quantidadeAtual - qtyToDeduct,
               });
            }
         }
      } else {
         const prontoAggregation: Record<string, number> = {};
         for (const item of formItems) {
            prontoAggregation[item.produtoId] = (prontoAggregation[item.produtoId] || 0) + item.quantidade;
         }
         for (const [prontoId, qtyToDeduct] of Object.entries(prontoAggregation)) {
            const prodPronto = estoquePronto.find(c => c.id === prontoId);
            if (prodPronto && prodPronto.quantidadeDisponivel >= qtyToDeduct) {
               const prontoRef = doc(db, 'estoque_pronto', prodPronto.id);
               batch.update(prontoRef, {
                 quantidadeDisponivel: prodPronto.quantidadeDisponivel - qtyToDeduct
               });
            }
         }
      }

      await batch.commit();
      
      // Revalidate cache
      forceRevalidateDashboard();

      toast.success('Pedido registrado com sucesso!');
      setIsModalOpen(false);
      
      // Reset form
      setFormTipoVenda('encomenda');
      setFormClienteId('');
      setFormItems([{ id: Date.now().toString(), produtoId: '', nome: '', quantidade: 1, valorUnitario: 0, detalhesCalculo: null, produtoOriginalId: '' }]);
      setFormDataEntrega('');
      setFormStatusPagamento('pendente');

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao salvar pedido.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuickEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      const newOrderRef = doc(collection(db, 'pedidos'));
      const docData = {
        userId: user.uid,
        cliente: 'avulso_historico',
        clienteNome: quickClient || 'Cliente (Histórico)',
        produtoId: 'registro_antigo',
        produtoNome: 'Registro Passado',
        valorFinal: parseFloat(quickTotal) || 0,
        dataEntrega: quickDate,
        data: quickDate,
        createdAt: quickDate, // Usa a mesma data para aparecer no faturamento da época
        statusPagamento: 'pago',
        statusProducao: 'finalizado',
        detalhesCalculo: {
           observacoes: quickNotes,
           valorUnitario: quickUnitValue ? parseFloat(quickUnitValue) : 0
        }
      };
      
      // We use batch or directly update. We don't have batch initialized here, let's just use writeBatch
      const batch = writeBatch(db);
      batch.set(newOrderRef, docData);
      await batch.commit();

      // Revalidate cache
      forceRevalidateDashboard();

      toast.success('Venda passada registrada!');
      
      setQuickTotal('');
      setQuickUnitValue('');
      setQuickClient('');
      setQuickNotes('');
      // Não fecha o modal nem limpa a data para agilizar o uso
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao salvar venda passada.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (confirm('Tem certeza que deseja excluir este pedido? Essa ação não devolve os itens ao estoque automaticamente.')) {
      try {
        await deleteDoc(doc(db, 'pedidos', orderId));
        forceRevalidateDashboard();
        toast.success('Pedido excluído.');
      } catch (e) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const changeProductionStatus = async (orderId: string, newStatus: ProductionStatus) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), { statusProducao: newStatus });
    } catch (e) {
      toast.error('Erro ao mover pedido.');
    }
  };

  const changePaymentStatus = async (orderId: string, currentStatus: PaymentStatus) => {
    const sequence: PaymentStatus[] = ['pendente', 'sinal', 'pago', 'pendente'];
    const idx = sequence.indexOf(currentStatus);
    const nextStatus = sequence[idx + 1];
    try {
      await updateDoc(doc(db, 'pedidos', orderId), { statusPagamento: nextStatus });
    } catch (e) {
      toast.error('Erro ao alterar pagamento.');
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.produtoNome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fila = filteredOrders.filter(o => o.statusProducao === 'fila' || !o.statusProducao);
  const producao = filteredOrders.filter(o => o.statusProducao === 'producao');
  const finalizado = filteredOrders.filter(o => o.statusProducao === 'finalizado');
  const entregue = filteredOrders.filter(o => o.statusProducao === 'entregue');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-foreground" size={48} />
      </div>
    );
  }

  const KanbanColumn = ({ title, icon: Icon, colorClass, items, nextStatus, prevStatus }: any) => (
    <div className="flex flex-col bg-slate-100/50 rounded-2xl border-2 border-border h-[calc(100vh-220px)] overflow-hidden">
      <div className={`p-4 border-b-2 border-border flex items-center gap-2 ${colorClass}`}>
        <Icon size={20} className="opacity-80" />
        <h3 className="font-black tracking-tight">{title} <span className="opacity-60 font-bold ml-1">({items.length})</span></h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {items.map((order: Order) => (
          <div key={order.id} className="bg-surface p-4 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow group flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-slate-800 text-base leading-tight">{order.clienteNome}</h4>
                <p className="text-sm font-medium text-slate-500 mt-0.5 leading-snug">{order.produtoNome}</p>
              </div>
              <button onClick={() => handleDelete(order.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold bg-background rounded-lg p-2 text-slate-600">
              <Clock size={14} className="text-slate-400" />
              Prazo: {order.dataEntrega ? new Date(order.dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : 'A Combinar'}
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="font-black text-success">{formatCurrency(order.valorFinal)}</span>
              <button 
                onClick={() => changePaymentStatus(order.id, order.statusPagamento)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                  order.statusPagamento === 'pago' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                  order.statusPagamento === 'sinal' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                  'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                {order.statusPagamento === 'pago' ? '✅ Pago 100%' :
                 order.statusPagamento === 'sinal' ? '⏳ Sinal 50%' : '🔴 Pendente'}
              </button>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border">
              {prevStatus ? (
                <button 
                  onClick={() => changeProductionStatus(order.id, prevStatus)}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-slate-500 hover:text-foreground hover:bg-slate-100 py-1.5 rounded-lg transition-colors"
                >
                  <ArrowLeft size={14} /> Voltar
                </button>
              ) : <div></div>}
              
              {nextStatus ? (
                <button 
                  onClick={() => changeProductionStatus(order.id, nextStatus)}
                  className="flex items-center justify-center gap-1 text-xs font-bold text-white bg-secondary hover:bg-secondary-hover py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  Avançar <ArrowRight size={14} />
                </button>
              ) : <div></div>}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center opacity-70">
            <ClipboardList size={32} className="mb-2" />
            <p className="text-sm font-bold">Nenhum pedido aqui</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans animate-in fade-in duration-500">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Painel de Produção</h1>
          <p className="text-success mt-1 font-bold">Gerencie pedidos em Kanban</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-3 bg-surface border-2 border-border rounded-xl focus:outline-none focus:border-primary font-medium text-slate-700 shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsQuickEntryOpen(true)}
            className="bg-surface border-2 border-border text-slate-600 hover:bg-background hover:text-foreground font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Clock size={20} />
            <span className="hidden sm:inline">Lançamento Rápido</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-[#FFAA00]/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Registrar Pedido
          </button>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-10">
        <KanbanColumn 
          title="Fila de Espera" icon={ClipboardList} colorClass="bg-slate-200 text-slate-700" 
          items={fila} nextStatus="producao" prevStatus={null}
        />
        <KanbanColumn 
          title="Em Produção" icon={Factory} colorClass="bg-blue-100 text-blue-700" 
          items={producao} nextStatus="finalizado" prevStatus="fila"
        />
        <KanbanColumn 
          title="Finalizados" icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-700" 
          items={finalizado} nextStatus="entregue" prevStatus="producao"
        />
        <KanbanColumn 
          title="Entregues / Enviados" icon={Truck} colorClass="bg-purple-100 text-purple-700" 
          items={entregue} nextStatus={null} prevStatus="finalizado"
        />
      </div>

      {/* MODAL NOVO PEDIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-foreground">Registrar Pedido</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveOrder} className="space-y-4">
                {/* Tipo de Venda Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    type="button" 
                    onClick={() => { 
                      setFormTipoVenda('encomenda'); 
                      setFormItems([{ id: Date.now().toString(), produtoId: '', nome: '', quantidade: 1, valorUnitario: 0, detalhesCalculo: null, produtoOriginalId: '' }]); 
                      setFormStatusPagamento('pendente'); 
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formTipoVenda === 'encomenda' ? 'bg-surface text-foreground shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Sob Encomenda
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { 
                      setFormTipoVenda('pronta_entrega'); 
                      setFormItems([{ id: Date.now().toString(), produtoId: '', nome: '', quantidade: 1, valorUnitario: 0, detalhesCalculo: null, produtoOriginalId: '' }]); 
                      setFormStatusPagamento('pago'); 
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formTipoVenda === 'pronta_entrega' ? 'bg-surface text-foreground shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Pronta-Entrega
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Cliente</label>
                  <select required value={formClienteId} onChange={e => setFormClienteId(e.target.value)} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium">
                    <option value="" disabled>Selecione um cliente...</option>
                    <option value="balcao">👤 Cliente Balcão (Avulso)</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-700">Itens da Encomenda</label>
                  </div>
                  
                  {formItems.map((item, index) => (
                    <div key={item.id} className="p-3 bg-background border-2 border-border rounded-xl space-y-3 relative group">
                      {formItems.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => setFormItems(formItems.filter((_, i) => i !== index))}
                          className="absolute -top-3 -right-3 bg-red-100 text-red-500 p-1.5 rounded-full hover:bg-red-500 hover:text-white shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      
                      <div>
                        <select 
                          required 
                          value={item.produtoId} 
                          onChange={e => handleItemProdutoChange(index, e.target.value)} 
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:border-primary outline-none font-medium text-sm"
                        >
                          <option value="" disabled>Selecione a peça...</option>
                          {formTipoVenda === 'encomenda' ? (
                            catalogo.map(c => (
                              <option key={c.id} value={c.id}>{c.nome} - {formatCurrency(c.precoFinal)}</option>
                            ))
                          ) : (
                            estoquePronto.filter(i => i.quantidadeDisponivel > 0).map(c => (
                              <option key={c.id} value={c.id}>{c.nome} (Restam: {c.quantidadeDisponivel}) - {formatCurrency(c.precoVenda)}</option>
                            ))
                          )}
                        </select>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Qtd</label>
                          <input 
                            required 
                            type="number" 
                            min="1" 
                            value={item.quantidade} 
                            onChange={e => {
                              const newItems = [...formItems];
                              newItems[index].quantidade = parseInt(e.target.value) || 1;
                              setFormItems(newItems);
                            }} 
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:border-primary outline-none font-bold text-slate-800 text-sm" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">V. Unit. (R$)</label>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={item.valorUnitario} 
                            onChange={e => {
                              const newItems = [...formItems];
                              newItems[index].valorUnitario = parseFloat(e.target.value) || 0;
                              setFormItems(newItems);
                            }} 
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:border-primary outline-none font-bold text-slate-800 text-sm" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    type="button" 
                    onClick={() => setFormItems([...formItems, { id: Date.now().toString(), produtoId: '', nome: '', quantidade: 1, valorUnitario: 0, detalhesCalculo: null, produtoOriginalId: '' }])}
                    className="w-full py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-sm border-2 border-dashed border-slate-300"
                  >
                    <Plus size={16} /> Adicionar Produto
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-100 p-3 rounded-xl border-2 border-border flex flex-col justify-center">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Valor Total</label>
                    <div className="font-black text-xl text-foreground">
                      {formatCurrency(formItems.reduce((acc, item) => acc + (item.quantidade * item.valorUnitario), 0))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data de Entrega</label>
                    <input type="date" value={formDataEntrega} onChange={e => setFormDataEntrega(e.target.value)} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-primary outline-none font-medium text-slate-600" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Status de Pagamento Inicial</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" disabled={formTipoVenda === 'pronta_entrega'} onClick={() => setFormStatusPagamento('pendente')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 disabled:opacity-30 ${formStatusPagamento === 'pendente' ? 'bg-red-100 border-red-200 text-red-600' : 'bg-background border-transparent text-slate-400 hover:bg-slate-100'}`}>
                      Pendente
                    </button>
                    <button type="button" disabled={formTipoVenda === 'pronta_entrega'} onClick={() => setFormStatusPagamento('sinal')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 disabled:opacity-30 ${formStatusPagamento === 'sinal' ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-background border-transparent text-slate-400 hover:bg-slate-100'}`}>
                      Sinal 50%
                    </button>
                    <button type="button" disabled={formTipoVenda === 'pronta_entrega' && formStatusPagamento !== 'pago'} onClick={() => setFormStatusPagamento('pago')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${formStatusPagamento === 'pago' ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-background border-transparent text-slate-400 hover:bg-slate-100'}`}>
                      Pago 100%
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={18} className="animate-spin" />}
                    Criar Pedido
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO RÁPIDO */}
      {isQuickEntryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                  <Clock className="text-purple-500" size={24} />
                  Venda Passada
                </h2>
                <button onClick={() => setIsQuickEntryOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveQuickEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data da Venda *</label>
                    <input required type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-purple-500 outline-none font-medium text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor Total (R$) *</label>
                    <input required type="number" step="0.01" min="0" value={quickTotal} onChange={e => setQuickTotal(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-purple-500 outline-none font-bold text-slate-800" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Valor Unitário (Opcional)</label>
                  <input type="number" step="0.01" min="0" value={quickUnitValue} onChange={e => setQuickUnitValue(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-purple-500 outline-none font-medium text-slate-700" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Cliente (Opcional)</label>
                  <input type="text" value={quickClient} onChange={e => setQuickClient(e.target.value)} placeholder="Nome do cliente" className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-purple-500 outline-none font-medium text-slate-700" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Materiais / Observações (Opcional)</label>
                  <textarea rows={3} value={quickNotes} onChange={e => setQuickNotes(e.target.value)} placeholder="O que foi gasto? Ex: 2m de tricoline" className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl focus:border-purple-500 outline-none font-medium text-slate-700 resize-none"></textarea>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="submit" disabled={saving} className="w-full px-6 py-4 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                    {saving ? <Loader2 size={20} className="animate-spin" /> : 'Lançar no Histórico'}
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
