'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Search, Loader2, Minus, Plus, Trash2,
  PackageCheck, Banknote, QrCode, CreditCard, CheckCircle2, PartyPopper
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { forceRevalidateDashboard } from '@/app/actions/finance';

interface EstoqueProntoItem {
  id: string;
  produtoId: string;
  nome: string;
  precoVenda: number;
  quantidadeDisponivel: number;
}

interface CartItem {
  prontoId: string;
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  maxDisponivel: number;
}

type FormaPagamento = 'dinheiro' | 'pix' | 'cartao';

export default function VendaBalcaoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [estoquePronto, setEstoquePronto] = useState<EstoqueProntoItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const qPronto = query(collection(db, 'estoque_pronto'), where('userId', '==', currentUser.uid));
        const unsubPronto = onSnapshot(qPronto, (snap) => {
          const p: EstoqueProntoItem[] = [];
          snap.forEach(docSnap => {
            const d = docSnap.data();
            p.push({
              id: docSnap.id,
              produtoId: d.produtoId,
              nome: d.nome || 'Produto',
              precoVenda: parseFloat(d.precoVenda || 0),
              quantidadeDisponivel: parseInt(d.quantidadeDisponivel || 0),
            });
          });
          setEstoquePronto(p);
          setLoading(false);
        });
        return () => unsubPronto();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const disponiveis = useMemo(() =>
    estoquePronto
      .filter(i => i.quantidadeDisponivel > 0)
      .filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [estoquePronto, searchTerm]
  );

  const total = cart.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
  const totalPecas = cart.reduce((acc, item) => acc + item.quantidade, 0);

  const addToCart = (item: EstoqueProntoItem) => {
    setLastSaleTotal(null);
    setCart(prev => {
      const existing = prev.find(c => c.prontoId === item.id);
      if (existing) {
        if (existing.quantidade >= item.quantidadeDisponivel) {
          toast.error(`Só restam ${item.quantidadeDisponivel} unidades de "${item.nome}".`);
          return prev;
        }
        return prev.map(c => c.prontoId === item.id ? { ...c, quantidade: c.quantidade + 1 } : c);
      }
      return [...prev, {
        prontoId: item.id,
        produtoId: item.produtoId,
        nome: item.nome,
        preco: item.precoVenda,
        quantidade: 1,
        maxDisponivel: item.quantidadeDisponivel,
      }];
    });
  };

  const changeQty = (prontoId: string, delta: number) => {
    setCart(prev => prev
      .map(c => {
        if (c.prontoId !== prontoId) return c;
        const newQty = c.quantidade + delta;
        if (newQty > c.maxDisponivel) {
          toast.error(`Só restam ${c.maxDisponivel} unidades de "${c.nome}".`);
          return c;
        }
        return { ...c, quantidade: newQty };
      })
      .filter(c => c.quantidade > 0)
    );
  };

  const removeFromCart = (prontoId: string) => {
    setCart(prev => prev.filter(c => c.prontoId !== prontoId));
  };

  const finalizarVenda = async () => {
    if (!user || cart.length === 0) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);

      // 1. Registrar o pedido já pago e entregue (venda de balcão)
      const newOrderRef = doc(collection(db, 'pedidos'));
      batch.set(newOrderRef, {
        userId: user.uid,
        cliente: 'balcao',
        clienteNome: 'Cliente Balcão',
        produtoId: 'multiplos',
        produtoNome: cart.length === 1 ? cart[0].nome : `${totalPecas} peças (balcão)`,
        valorFinal: total,
        dataEntrega: new Date().toISOString().split('T')[0],
        statusPagamento: 'pago',
        statusProducao: 'entregue',
        formaPagamento,
        origem: 'pdv_balcao',
        items: cart.map(item => ({
          id: item.produtoId,
          produtoId: item.prontoId,
          name: item.nome,
          quantity: item.quantidade,
          price: item.preco,
        })),
        createdAt: serverTimestamp(),
      });

      // 2. Baixa automática na prateleira de pronta-entrega
      for (const item of cart) {
        const prontoAtual = estoquePronto.find(e => e.id === item.prontoId);
        if (!prontoAtual) continue;
        const novaQtd = Math.max(0, prontoAtual.quantidadeDisponivel - item.quantidade);
        batch.update(doc(db, 'estoque_pronto', item.prontoId), {
          quantidadeDisponivel: novaQtd,
        });
      }

      await batch.commit();
      forceRevalidateDashboard();

      setLastSaleTotal(total);
      setCart([]);
      toast.success('Venda registrada e estoque atualizado!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar a venda. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-foreground" size={48} />
      </div>
    );
  }

  const pagamentos: { id: FormaPagamento; label: string; icon: any }[] = [
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
    { id: 'pix', label: 'Pix', icon: QrCode },
    { id: 'cartao', label: 'Cartão', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
          <ShoppingCart className="text-primary" size={34} />
          Venda de Balcão
        </h1>
        <p className="text-success mt-1 font-bold">Toque na peça, confira o total e pronto — estoque baixa sozinho.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-32 lg:pb-10">

        {/* ===== Coluna 1-2: Produtos ===== */}
        <div className="lg:col-span-2">
          <div className="relative mb-4">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar peça na prateleira..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg bg-surface border-2 border-border rounded-2xl focus:outline-none focus:border-primary font-medium text-slate-700 shadow-sm"
            />
          </div>

          {disponiveis.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-surface rounded-3xl border-2 border-dashed border-border text-center px-6">
              <PackageCheck size={64} className="mb-4 text-slate-300" />
              <h3 className="text-2xl font-black text-slate-500 mb-2">Nada disponível para venda</h3>
              <p className="text-slate-500 font-medium max-w-sm">
                Adicione peças prontas na tela <strong>Pronta-Entrega</strong> para vendê-las aqui no balcão.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {disponiveis.map(item => {
                const noCarrinho = cart.find(c => c.prontoId === item.id)?.quantidade || 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`relative text-left bg-surface rounded-2xl border-2 p-4 transition-all active:scale-[0.97] ${
                      noCarrinho > 0 ? 'border-primary shadow-md' : 'border-border hover:border-primary/40 hover:shadow-sm'
                    }`}
                  >
                    {noCarrinho > 0 && (
                      <span className="absolute -top-2 -right-2 w-7 h-7 bg-primary text-slate-900 text-sm font-black rounded-full flex items-center justify-center shadow">
                        {noCarrinho}
                      </span>
                    )}
                    <p className="font-black text-slate-800 leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">{item.nome}</p>
                    <p className="text-xl font-black text-success">{formatCurrency(item.precoVenda)}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">{item.quantidadeDisponivel} em estoque</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== Coluna 3: Carrinho ===== */}
        <div className="lg:sticky lg:top-8 h-fit">
          <div className="bg-surface rounded-3xl border-2 border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b-2 border-border flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <ShoppingCart size={22} className="text-primary" /> Carrinho
              </h2>
              {cart.length > 0 && (
                <span className="bg-primary/10 text-slate-800 text-sm font-black px-3 py-1 rounded-full">
                  {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}
                </span>
              )}
            </div>

            <div className="p-5 space-y-4">
              {lastSaleTotal !== null && cart.length === 0 && (
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center animate-in zoom-in-95 duration-300">
                  <PartyPopper className="mx-auto text-green-600 mb-2" size={32} />
                  <p className="font-black text-green-700 text-lg">Venda de {formatCurrency(lastSaleTotal)} registrada!</p>
                  <p className="text-sm font-medium text-green-600 mt-1">O estoque já foi atualizado. Boa venda! 🎉</p>
                </div>
              )}

              {cart.length === 0 && lastSaleTotal === null && (
                <p className="text-center text-slate-400 font-medium py-8">
                  Toque nas peças ao lado para adicionar à venda.
                </p>
              )}

              {cart.map(item => (
                <div key={item.prontoId} className="flex items-center gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{item.nome}</p>
                    <p className="text-sm font-black text-success">{formatCurrency(item.preco * item.quantidade)}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background rounded-xl border border-border p-1 shrink-0">
                    <button
                      onClick={() => changeQty(item.prontoId, -1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="w-6 text-center font-black text-foreground">{item.quantidade}</span>
                    <button
                      onClick={() => changeQty(item.prontoId, 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors shadow-sm"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.prontoId)}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {cart.length > 0 && (
                <>
                  {/* Forma de pagamento */}
                  <div>
                    <p className="text-sm font-black text-slate-500 uppercase tracking-wider mb-2">Como recebeu?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {pagamentos.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => setFormaPagamento(id)}
                          className={`py-3 rounded-xl border-2 flex flex-col items-center gap-1 text-sm font-bold transition-all ${
                            formaPagamento === id
                              ? 'border-primary bg-primary/5 text-slate-900'
                              : 'border-border bg-background text-slate-500 hover:border-primary/40'
                          }`}
                        >
                          <Icon size={20} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between bg-background rounded-2xl border-2 border-border p-4">
                    <span className="text-lg font-black text-slate-500 uppercase tracking-wider">Total</span>
                    <span className="text-3xl font-black text-slate-900">{formatCurrency(total)}</span>
                  </div>

                  <button
                    onClick={finalizarVenda}
                    disabled={saving}
                    className="w-full bg-primary hover:bg-primary-hover text-slate-900 font-black text-xl py-5 rounded-2xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                  >
                    {saving ? (
                      <><Loader2 className="animate-spin" size={24} /> Registrando...</>
                    ) : (
                      <><CheckCircle2 size={24} /> Finalizar Venda</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra fixa no mobile com o total */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 lg:hidden bg-surface/95 backdrop-blur border-t-2 border-border p-4 flex items-center justify-between gap-4 z-40">
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(total)}</p>
          </div>
          <button
            onClick={finalizarVenda}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-slate-900 font-black text-lg py-4 px-6 rounded-2xl shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={22} />}
            Finalizar
          </button>
        </div>
      )}
    </div>
  );
}
