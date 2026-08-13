'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Search, Loader2, Minus, Plus, Trash2,
  PackageCheck, Banknote, QrCode, CreditCard, CheckCircle2, PartyPopper, TicketPercent
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { registrarVenda } from '@/app/actions/sales';
import { applyDiscount, calculateChange, roundCents, DiscountMode } from '@/lib/pricingEngine';
import { EstoqueProntoItem, ItemVenda } from '@/lib/erpTypes';

interface CartItem {
  prontoId: string;
  produtoId: string;
  nome: string;
  /** Preço unitário editável no carrinho (negociação rápida no balcão). */
  preco: number;
  precoOriginal: number;
  custoUnitario: number;
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
  const [desconto, setDesconto] = useState('');
  const [descontoModo, setDescontoModo] = useState<DiscountMode>('valor');
  const [valorRecebido, setValorRecebido] = useState('');
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
              custoUnitario: parseFloat(d.custoUnitario || 0),
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

  // --- Totais (todos derivados, sem estado intermediário) ---
  const subtotal = roundCents(cart.reduce((acc, item) => acc + item.preco * item.quantidade, 0));
  const totalPecas = cart.reduce((acc, item) => acc + item.quantidade, 0);
  const descontoNum = parseFloat(desconto) || 0;
  const total = applyDiscount(subtotal, descontoNum, descontoModo);
  const valorDesconto = roundCents(subtotal - total);
  const custoTotal = roundCents(cart.reduce((acc, item) => acc + item.custoUnitario * item.quantidade, 0));
  const recebidoNum = parseFloat(valorRecebido) || 0;
  const troco = calculateChange(recebidoNum, total);
  const dinheiroInsuficiente = formaPagamento === 'dinheiro' && valorRecebido.trim() !== '' && recebidoNum < total;

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
        precoOriginal: item.precoVenda,
        custoUnitario: item.custoUnitario,
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

  const changePrice = (prontoId: string, novoPreco: string) => {
    const precoNum = parseFloat(novoPreco);
    setCart(prev => prev.map(c =>
      c.prontoId === prontoId ? { ...c, preco: isNaN(precoNum) ? 0 : Math.max(0, precoNum) } : c
    ));
  };

  const removeFromCart = (prontoId: string) => {
    setCart(prev => prev.filter(c => c.prontoId !== prontoId));
  };

  const limparVenda = () => {
    setCart([]);
    setDesconto('');
    setDescontoModo('valor');
    setValorRecebido('');
  };

  const finalizarVenda = async () => {
    if (!user || cart.length === 0) return;

    if (total <= 0) {
      toast.error('O total da venda não pode ser zero. Revise preços e desconto.');
      return;
    }

    if (dinheiroInsuficiente) {
      toast.error(`Valor recebido (${formatCurrency(recebidoNum)}) é menor que o total da venda.`);
      return;
    }

    setSaving(true);
    try {
      // Itens antigos na prateleira podem não ter custoUnitario — busca no catálogo
      // antes de gravar, para o lucro líquido do pedido não sair inflado. O motor
      // de vendas (registrarVenda) confia no custo que ele recebe: transações do
      // Firestore só leem por referência direta, então essa resolução (que
      // depende de uma query por produtoId) precisa acontecer aqui, antes.
      const custosResolvidos = new Map<string, number>();
      await Promise.all(cart.map(async (item) => {
        if (item.custoUnitario > 0 || !item.produtoId) return;
        try {
          const catSnap = await getDoc(doc(db, 'catalogo', item.produtoId));
          if (catSnap.exists()) {
            const d = catSnap.data();
            custosResolvidos.set(item.prontoId, parseFloat(d.custoBase || d.custo || 0) || 0);
          }
        } catch { /* item segue com custo 0; melhor vender do que travar a fila do balcão */ }
      }));

      const cartComCusto = cart.map(item => ({
        ...item,
        custoUnitario: item.custoUnitario > 0 ? item.custoUnitario : (custosResolvidos.get(item.prontoId) || 0),
      }));
      const custoTotalFinal = roundCents(cartComCusto.reduce((acc, item) => acc + item.custoUnitario * item.quantidade, 0));

      const itens: ItemVenda[] = cartComCusto.map(item => ({
        estoqueId: item.prontoId,
        tipoEstoque: 'pronta_entrega',
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.preco,
        custoUnitario: item.custoUnitario,
      }));

      const resultado = await registrarVenda({
        userId: user.uid,
        itens,
        valorTotal: total,
        custoTotal: custoTotalFinal,
        formaPagamento,
        origem: 'pdv',
        produtoNome: cart.length === 1 ? cart[0].nome : `${totalPecas} peças (balcão)`,
        metadados: {
          subtotal,
          desconto: valorDesconto,
          descontoModo: valorDesconto > 0 ? descontoModo : null,
          dataEntrega: new Date().toISOString().split('T')[0],
          ...(formaPagamento === 'dinheiro' && valorRecebido.trim() !== '' ? { valorRecebido: recebidoNum, troco } : {}),
        },
      });

      if (!resultado.success) {
        toast.error(resultado.error || 'Erro ao registrar a venda. Tente novamente.');
        return;
      }

      setLastSaleTotal(total);
      limparVenda();
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

  const podeFinalizar = !saving && total > 0 && !dinheiroInsuficiente;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
          <ShoppingCart className="text-primary" size={34} />
          Venda de Balcão
        </h1>
        <p className="text-success mt-1 font-bold">Toque na peça, ajuste preço e desconto se precisar — estoque e financeiro atualizam sozinhos.</p>
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
                <div key={item.prontoId} className="border-b border-border pb-4 last:border-b-0 last:pb-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <p className="flex-1 min-w-0 font-bold text-slate-800 truncate">{item.nome}</p>
                    <button
                      onClick={() => removeFromCart(item.prontoId)}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Preço unitário editável — negociação rápida no balcão */}
                    <div className="flex items-center gap-1 bg-background rounded-xl border border-border px-2 py-1 flex-1 min-w-0">
                      <span className="text-xs font-black text-slate-400 shrink-0">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.preco}
                        onChange={(e) => changePrice(item.prontoId, e.target.value)}
                        className="w-full bg-transparent font-black text-slate-800 focus:outline-none py-1"
                        title="Preço unitário (editável)"
                      />
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
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-black text-success">{formatCurrency(item.preco * item.quantidade)}</span>
                    {item.preco !== item.precoOriginal && (
                      <span className="text-xs font-bold text-slate-400 line-through">{formatCurrency(item.precoOriginal * item.quantidade)}</span>
                    )}
                  </div>
                </div>
              ))}

              {cart.length > 0 && (
                <>
                  {/* Desconto */}
                  <div>
                    <p className="text-sm font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <TicketPercent size={16} /> Desconto (opcional)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                        placeholder="0"
                        className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-border bg-background font-bold text-slate-800 focus:outline-none focus:border-primary"
                      />
                      <div className="flex rounded-xl border-2 border-border overflow-hidden shrink-0">
                        <button
                          onClick={() => setDescontoModo('valor')}
                          className={`px-3 py-2 text-sm font-black transition-colors ${descontoModo === 'valor' ? 'bg-primary text-slate-900' : 'bg-background text-slate-500'}`}
                        >
                          R$
                        </button>
                        <button
                          onClick={() => setDescontoModo('percentual')}
                          className={`px-3 py-2 text-sm font-black transition-colors ${descontoModo === 'percentual' ? 'bg-primary text-slate-900' : 'bg-background text-slate-500'}`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                  </div>

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

                  {/* Dinheiro: valor recebido + troco */}
                  {formaPagamento === 'dinheiro' && (
                    <div className="bg-background rounded-2xl border-2 border-border p-4 space-y-3">
                      <div>
                        <label className="text-sm font-bold text-slate-600 mb-1 block">Valor Recebido (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={valorRecebido}
                          onChange={(e) => setValorRecebido(e.target.value)}
                          placeholder={total > 0 ? total.toFixed(2) : '0,00'}
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-surface font-black text-lg text-slate-800 focus:outline-none focus:border-primary"
                        />
                      </div>
                      {dinheiroInsuficiente ? (
                        <p className="text-sm font-bold text-red-500">
                          Faltam {formatCurrency(roundCents(total - recebidoNum))} para completar o pagamento.
                        </p>
                      ) : valorRecebido.trim() !== '' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-slate-500 uppercase tracking-wider">Troco</span>
                          <span className="text-2xl font-black text-success">{formatCurrency(troco)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Totais */}
                  <div className="bg-background rounded-2xl border-2 border-border p-4 space-y-2">
                    {valorDesconto > 0 && (
                      <>
                        <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                          <span>Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-bold text-red-500">
                          <span>Desconto{descontoModo === 'percentual' ? ` (${descontoNum}%)` : ''}</span>
                          <span>- {formatCurrency(valorDesconto)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-slate-500 uppercase tracking-wider">Total</span>
                      <span className="text-3xl font-black text-slate-900">{formatCurrency(total)}</span>
                    </div>
                    {custoTotal > 0 && total > 0 && (
                      <p className="text-xs font-bold text-slate-400 text-right">
                        Lucro estimado: {formatCurrency(roundCents(total - custoTotal))}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={finalizarVenda}
                    disabled={!podeFinalizar}
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
            disabled={!podeFinalizar}
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
