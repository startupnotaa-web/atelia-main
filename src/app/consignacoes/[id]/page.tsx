'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Percent, Plus, ArrowLeft, ShoppingBag, DollarSign, RotateCcw, CheckCircle } from 'lucide-react';
import { useTenant } from '@/lib/TenantProvider';
import { StoreType } from '../page';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { revalidatePathCache } from '@/app/actions/cache';
import { toast as hotToast } from 'react-hot-toast';

type ConsignedItem = {
  id: string;
  storeId: string;
  productId?: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
};

export default function StoreDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const { canAccessPDV } = useTenant();
  
  const [store, setStore] = useState<StoreType | null>(null);
  const [items, setItems] = useState<ConsignedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Modals
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<string | null>(null); // id do item
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<string | null>(null); // id do item

  // Form states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sendQuantity, setSendQuantity] = useState('1');
  
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [returnQuantity, setReturnQuantity] = useState('1');

  // Success Feedback
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!canAccessPDV) {
      router.push('/dashboard');
      return;
    }

    const fetchData = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            // Carregar a loja
            const storeRef = doc(db, 'partnerStores', unwrappedParams.id);
            const storeSnap = await getDoc(storeRef);
            if (storeSnap.exists() && storeSnap.data().userId === user.uid) {
              setStore({ id: storeSnap.id, ...storeSnap.data() } as StoreType);
            } else {
              router.push('/consignacoes');
              return;
            }

            // Carregar itens desta loja
            const qItems = query(
              collection(db, 'partnerProducts'), 
              where('storeId', '==', unwrappedParams.id),
              where('userId', '==', user.uid)
            );
            const itemsSnap = await getDocs(qItems);
            const itemsData: ConsignedItem[] = [];
            itemsSnap.forEach(doc => {
              const d = doc.data();
              itemsData.push({
                id: doc.id,
                storeId: d.storeId,
                productId: d.productId,
                productName: d.productName,
                quantity: d.quantity,
                pricePerUnit: d.pricePerUnit
              });
            });
            setItems(itemsData);

            // Carregar produtos do Firebase (catálogo)
            const qProd = query(collection(db, 'catalogo'), where('userId', '==', user.uid));
            const prodSnap = await getDocs(qProd);
            const prodData: Product[] = [];
            prodSnap.forEach((doc) => {
              const p = doc.data();
              prodData.push({ id: doc.id, name: p.nome, price: p.precoFinal });
            });
            setProducts(prodData);
            if (prodData.length > 0) setSelectedProduct(prodData[0]);

          } catch (error) {
            console.error("Erro ao buscar dados da loja:", error);
            hotToast.error("Erro ao buscar dados na nuvem.");
          }
        }
      });
      return () => unsubscribe();
    };

    fetchData();
  }, [unwrappedParams.id, canAccessPDV, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendItems = async () => {
    if (!selectedProduct) return alert('Selecione um produto.');
    const qty = parseInt(sendQuantity);
    if (!qty || qty <= 0) return alert('Insira uma quantidade válida.');
    
    const user = auth.currentUser;
    if (!user) return alert('Faça login primeiro.');

    try {
      const newItemData = {
        userId: user.uid,
        storeId: unwrappedParams.id,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        pricePerUnit: selectedProduct.price,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'partnerProducts'), newItemData);
      
      const newItem: ConsignedItem = {
        id: docRef.id,
        storeId: newItemData.storeId,
        productId: newItemData.productId,
        productName: newItemData.productName,
        quantity: newItemData.quantity,
        pricePerUnit: newItemData.pricePerUnit
      };

      setItems([...items, newItem]);
      setIsSendModalOpen(false);
      setSendQuantity('1');
      showToast(`📦 ${qty}x ${selectedProduct.name} enviados para a loja!`);
      await revalidatePathCache(`/consignacoes/${unwrappedParams.id}`);
    } catch (e) {
      console.error(e);
      hotToast.error('Erro ao salvar no banco de dados. Verifique a conexão.');
    }
  };

  const handleRegisterSale = async (item: ConsignedItem) => {
    const qty = parseInt(saleQuantity);
    if (!qty || qty <= 0 || qty > item.quantity) return alert('Quantidade inválida ou maior que o estoque na loja.');

    const totalVenda = qty * item.pricePerUnit;
    const comissao = totalVenda * ((store?.commissionPercent || 0) / 100);
    const lucroLiquido = totalVenda - comissao;

    const authUser = auth.currentUser;
    if (!authUser) return alert('Faça login primeiro.');

    try {
      const batch = writeBatch(db);

      // 1. Lançar no Financeiro (Entrada/Receita)
      const financeRef = doc(collection(db, 'finance_entries'));
      batch.set(financeRef, {
        userId: authUser.uid,
        type: 'entrada',
        category: 'Venda Consignada',
        value: lucroLiquido,
        description: `Venda na loja ${store?.name} - ${qty}x ${item.productName}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      // 2. Subtrair do Estoque de Produtos Prontos
      if (item.productId) {
        const qPronto = query(
          collection(db, 'estoque_pronto'), 
          where('userId', '==', authUser.uid), 
          where('produtoId', '==', item.productId)
        );
        const snap = await getDocs(qPronto);
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          const currentQty = snap.docs[0].data().quantidadeDisponivel || 0;
          const newQty = Math.max(0, currentQty - qty);
          batch.update(doc(db, 'estoque_pronto', docId), {
            quantidadeDisponivel: newQty
          });
        }
      }

      // 3. Atualizar o item de consignação na nuvem
      const itemRef = doc(db, 'partnerProducts', item.id);
      const newQty = item.quantity - qty;
      if (newQty <= 0) {
        batch.delete(itemRef);
      } else {
        batch.update(itemRef, { quantity: newQty });
      }

      await batch.commit();

      const updated = items.map(i => {
        if (i.id === item.id) return { ...i, quantity: newQty };
        return i;
      }).filter(i => i.quantity > 0); // Remove se zerou

      setItems(updated);
      setIsSaleModalOpen(null);
      setSaleQuantity('1');
      
      showToast(`💰 Venda Registrada! Lucro Líquido de R$ ${lucroLiquido.toFixed(2)} adicionado à sua Dashboard.`);
      await revalidatePathCache(`/consignacoes/${unwrappedParams.id}`);
    } catch (e) {
      console.error(e);
      hotToast.error('Erro ao registrar a venda.');
    }
  };

  const handleReturn = async (item: ConsignedItem) => {
    const qty = parseInt(returnQuantity);
    if (!qty || qty <= 0 || qty > item.quantity) return alert('Quantidade inválida ou maior que o estoque na loja.');
    
    const user = auth.currentUser;
    if (!user) return alert('Faça login primeiro.');

    try {
      const itemRef = doc(db, 'partnerProducts', item.id);
      const newQty = item.quantity - qty;
      if (newQty <= 0) {
        await deleteDoc(itemRef);
      } else {
        await updateDoc(itemRef, { quantity: newQty });
      }

      const updated = items.map(i => {
        if (i.id === item.id) return { ...i, quantity: newQty };
        return i;
      }).filter(i => i.quantity > 0);

      setItems(updated);
      setIsReturnModalOpen(null);
      setReturnQuantity('1');
      showToast(`🔙 ${qty}x devolvidos ao seu estoque principal do Ateliê.`);
      await revalidatePathCache(`/consignacoes/${unwrappedParams.id}`);
    } catch (e) {
      console.error(e);
      hotToast.error('Erro ao atualizar no banco de dados. Verifique a conexão.');
    }
  };

  if (!store) return <div className="p-20 text-center font-bold text-slate-500">Carregando dados da loja...</div>;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl animate-step-enter">
          <CheckCircle size={22} className="text-success shrink-0" />
          <span className="text-base font-bold">{toast}</span>
        </div>
      )}

      {/* HEADER DE NAVEGAÇÃO E RESUMO DA LOJA */}
      <div className="bg-surface border-4 border-border p-8 md:p-10 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <Link href="/consignacoes" className="text-foreground/50 hover:text-primary font-bold flex items-center gap-2 mb-4 transition-colors">
            <ArrowLeft size={20} /> Voltar para Lojas
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-[#B24020]">
              <Store size={36} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-foreground">{store.name}</h1>
              <div className="flex items-center gap-2 text-lg font-bold text-slate-500 mt-1">
                Comissão Acordada: <span className="text-foreground">{store.commissionPercent}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsSendModalOpen(true)}
          className="bg-primary hover:bg-[#e69900] text-foreground text-xl font-black py-4 px-8 rounded-2xl transition-colors shadow-lg border-2 border-[#FFAA00] w-full md:w-auto flex justify-center items-center gap-2"
        >
          <Plus size={28} /> Enviar Peças
        </button>
      </div>

      <h2 className="text-2xl font-black text-foreground px-2">Mostruário na Loja</h2>

      {/* LISTA DE PRODUTOS CONSIGNADOS */}
      {items.length === 0 ? (
        <div className="w-full text-center p-16 border-4 border-dashed border-[#FFAA00]/20 rounded-[2rem] bg-[#FDFBF7] flex flex-col items-center justify-center">
          <ShoppingBag size={64} className="text-foreground/30 mb-4" />
          <h2 className="text-3xl font-black text-foreground mb-3">O mostruário está vazio.</h2>
          <p className="text-xl text-foreground/70 font-medium max-w-md mb-8">Nenhuma peça do seu ateliê está exposta nesta loja no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-surface rounded-[2rem] p-6 shadow-sm border-4 border-border flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Peça Exposta</p>
                  <h3 className="text-2xl font-black text-foreground">{item.productName}</h3>
                </div>
                <div className="bg-secondary/5 px-4 py-2 rounded-xl text-center border border-secondary/10">
                  <p className="text-xs font-bold text-slate-500 uppercase">Qtd Atual</p>
                  <p className="text-2xl font-black text-foreground">{item.quantity}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsSaleModalOpen(item.id)}
                  className="flex-1 bg-[#4A5D23] hover:bg-[#3d4d1d] text-white text-lg font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <DollarSign size={20} /> Registrar Venda
                </button>
                <button 
                  onClick={() => setIsReturnModalOpen(item.id)}
                  className="flex-1 bg-[#B24020] hover:bg-[#913219] text-white text-lg font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <RotateCcw size={20} /> Devolver ao Ateliê
                </button>
              </div>

              {/* MODAL: REGISTRAR VENDA */}
              {isSaleModalOpen === item.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSaleModalOpen(null)} />
                  <div className="relative bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                    <h3 className="text-2xl font-black text-success mb-2">Registrar Venda na Loja</h3>
                    <p className="text-slate-600 font-medium mb-6">Quantas unidades de "{item.productName}" foram vendidas?</p>
                    
                    <input 
                      type="number" min="1" max={item.quantity}
                      value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)}
                      className="w-full text-3xl p-6 border-2 border-border rounded-2xl font-black focus:border-[#4A5D23] outline-none text-center mb-6"
                    />

                    <div className="bg-[#FDFBF7] p-4 rounded-2xl border-2 border-border mb-6 space-y-2">
                      <div className="flex justify-between text-sm font-bold text-slate-500">
                        <span>Valor de Venda (Unidade):</span>
                        <span>R$ {item.pricePerUnit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-500">
                        <span>Comissão da Loja ({store.commissionPercent}%):</span>
                        <span className="text-[#B24020]">- R$ {(item.pricePerUnit * (store.commissionPercent / 100)).toFixed(2)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t-2 border-border flex justify-between text-lg font-black text-foreground">
                        <span>Seu Lucro Líquido:</span>
                        <span className="text-success">R$ {(item.pricePerUnit * (1 - store.commissionPercent / 100)).toFixed(2)} / un</span>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => setIsSaleModalOpen(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-4 rounded-xl">Cancelar</button>
                      <button onClick={() => handleRegisterSale(item)} className="flex-[2] bg-[#4A5D23] text-white font-bold py-4 rounded-xl shadow-sm">Confirmar Venda</button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL: DEVOLVER */}
              {isReturnModalOpen === item.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsReturnModalOpen(null)} />
                  <div className="relative bg-surface w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                    <h3 className="text-2xl font-black text-[#B24020] mb-2">Devolver ao Ateliê</h3>
                    <p className="text-slate-600 font-medium mb-6">Quantas unidades de "{item.productName}" estão retornando para o seu estoque principal?</p>
                    
                    <input 
                      type="number" min="1" max={item.quantity}
                      value={returnQuantity} onChange={e => setReturnQuantity(e.target.value)}
                      className="w-full text-3xl p-6 border-2 border-border rounded-2xl font-black focus:border-[#B24020] outline-none text-center mb-8"
                    />

                    <div className="flex gap-4">
                      <button onClick={() => setIsReturnModalOpen(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-4 rounded-xl">Cancelar</button>
                      <button onClick={() => handleReturn(item)} className="flex-[2] bg-[#B24020] text-white font-bold py-4 rounded-xl shadow-sm">Confirmar Retirada</button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* MODAL: ENVIAR PEÇAS */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSendModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-foreground mb-8">Enviar Peças Prontas</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-bold text-foreground mb-3">Selecione o Produto (Do Ateliê)</label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                  {products.length === 0 && <p className="text-slate-500 italic">Nenhum produto cadastrado no catálogo.</p>}
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      className={`text-left p-4 rounded-xl border-2 font-bold transition-all ${
                        selectedProduct?.id === prod.id 
                          ? 'border-[#FFAA00] bg-primary/10 text-foreground' 
                          : 'border-border text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {prod.name} <span className="float-right font-black">R$ {prod.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xl font-bold text-foreground mb-3">Quantidade a Enviar</label>
                <input 
                  type="number" min="1"
                  value={sendQuantity} onChange={e => setSendQuantity(e.target.value)}
                  className="w-full text-3xl p-6 border-2 border-border rounded-2xl font-black focus:border-primary outline-none text-center"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setIsSendModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 text-xl font-bold py-4 rounded-2xl">Cancelar</button>
              <button onClick={handleSendItems} className="flex-[2] bg-primary text-foreground text-xl font-black py-4 rounded-2xl shadow-sm border-2 border-[#FFAA00]">
                Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
