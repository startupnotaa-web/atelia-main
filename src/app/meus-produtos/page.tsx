'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Package, Plus, Eye, EyeOff, Trash2, ChevronDown, Receipt } from 'lucide-react';
import Link from 'next/link';
import { fetchUserLimitsAction } from '@/app/actions/user';
import CostReceipt from '@/components/CostReceipt';
import type { PricingBreakdownItem } from '@/lib/pricingEngine';

type CostBreakdown = {
  maoDeObra?: number;
  materiais?: any[];
  taxaDesperdicio?: number;
  custoDesperdicio?: number;
  ferramentas?: any[];
  custosFixos?: number;
  embalagens?: number;
  taxas?: { margem?: number; maquininha?: number; plataforma?: number; imposto?: number };
  precoAjustadoManualmente?: boolean;
};

type Product = {
  id: string;
  nome: string;
  categoria: string;
  fotoUrl: string;
  precoFinal: number;
  custoBase: number;
  lucroReal: number;
  margemLucro: number;
  visivelNaVitrine?: boolean;
  createdAt: string;
  detalhesCalculo?: CostBreakdown;
};

/**
 * Converte o `detalhesCalculo` salvo pelo getPayloadBase() da Calculadora
 * no formato `PricingBreakdownItem[]` que o CostReceipt espera.
 */
function buildBreakdownFromDetails(details: CostBreakdown, precoFinal: number): PricingBreakdownItem[] {
  const custoMateriais = (details.materiais || []).reduce((sum: number, m: any) => {
    const qty = parseFloat(m.quantidade) || 0;
    if (m.isEstoque) return sum + (qty * (parseFloat(m.valorBaseUnidade) || 0));
    return sum + (parseFloat(m.custo) || 0);
  }, 0) + (details.custoDesperdicio || 0);

  const custoFerramentas = (details.ferramentas || []).reduce((sum: number, f: any) => sum + (f.custoTotal || 0), 0);

  const taxas = details.taxas || {};
  const maquininha = taxas.maquininha || 0;
  const plataforma = taxas.plataforma || 0;
  const imposto = taxas.imposto || 0;
  const totalTaxas = precoFinal * ((maquininha + plataforma + imposto) / 100);

  const margem = taxas.margem || 0;
  const lucro = precoFinal * (margem / 100);

  return [
    { label: 'Materiais', valor: custoMateriais },
    { label: 'Mão de Obra', valor: details.maoDeObra || 0 },
    { label: 'Ferramentas', valor: custoFerramentas },
    { label: 'Custos Fixos', valor: details.custosFixos || 0 },
    { label: 'Embalagem/Frete', valor: details.embalagens || 0 },
    { label: 'Taxas (cartão/plataforma/imposto)', valor: Math.round(totalTaxas * 100) / 100 },
    { label: 'Lucro', valor: Math.round(lucro * 100) / 100 },
  ];
}

export default function MeusProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLimits, setUserLimits] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const q = query(
              collection(db, 'catalogo'),
              where('userId', '==', user.uid)
            );
            const querySnapshot = await getDocs(q);
            const data: Product[] = [];
            querySnapshot.forEach((doc) => {
              data.push({ id: doc.id, ...doc.data() } as Product);
            });
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setProducts(data);
            
            try {
              const limitsData = await fetchUserLimitsAction(user.uid);
              setUserLimits(limitsData);
            } catch(e) {}
          } catch (error) {
            console.error("Erro ao buscar produtos:", error);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    };

    fetchProducts();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const toggleVisibility = async (productId: string, currentVisibility: boolean) => {
    const newVisibility = currentVisibility === undefined ? false : !currentVisibility;
    setProducts(products.map(p => p.id === productId ? { ...p, visivelNaVitrine: newVisibility } : p));
    
    try {
      await updateDoc(doc(db, 'catalogo', productId), {
        visivelNaVitrine: newVisibility
      });
    } catch (err) {
      console.error(err);
      setProducts(products.map(p => p.id === productId ? { ...p, visivelNaVitrine: currentVisibility } : p));
      alert("Erro ao atualizar a visibilidade.");
    }
  };

  const handleDelete = async (productId: string) => {
    if (confirm("Tem certeza que deseja excluir este produto do catálogo?")) {
      try {
        await deleteDoc(doc(db, 'catalogo', productId));
        setProducts(products.filter(p => p.id !== productId));
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir o produto.");
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando catálogo...</div>;
  }

  return (
    <div className="w-full min-h-screen bg-background py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-secondary">Meu Catálogo</h1>
            <p className="text-slate-600 mt-2">Suas peças precificadas e prontas para venda.</p>
          </div>
          <Link href="/calculadora" className="bg-primary hover:bg-primary-hover text-slate-900 font-bold px-6 py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Plus size={20} /> Nova Precificação
          </Link>
        </div>

        {userLimits && !userLimits.isPro && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-amber-800 font-bold text-sm">Plano Grátis: Limite de Peças Salvas no Catálogo</p>
              <p className="text-amber-700 text-xs mt-1">Você usou {userLimits.usage.savedProducts} de {userLimits.limits.savedProducts} produtos disponíveis.</p>
            </div>
            {userLimits.usage.savedProducts >= userLimits.limits.savedProducts && (
              <Link href="/perfil" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0 text-center">
                Fazer Upgrade
              </Link>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <div className="bg-surface rounded-[2rem] border-4 border-dashed border-border p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-6">
              <Package size={48} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Seu catálogo está vazio.</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">Use a calculadora para precificar suas criações e salve sua primeira peça aqui!</p>
            <Link href="/calculadora" className="bg-slate-900 hover:bg-black text-white font-bold px-8 py-4 rounded-xl transition-colors">
              Ir para Calculadora
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map(product => {
              const isVisible = product.visivelNaVitrine !== false;
              const isExpanded = expandedId === product.id;
              const hasBreakdown = !!product.detalhesCalculo;

              return (
              <div key={product.id} className={`bg-surface rounded-3xl shadow-sm border border-border overflow-hidden hover:shadow-md transition-all group flex flex-col relative ${!isVisible ? 'opacity-70' : ''}`}>
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                  <button 
                    onClick={() => toggleVisibility(product.id, isVisible)}
                    className="bg-surface/90 backdrop-blur-sm hover:bg-surface text-slate-700 p-2 rounded-full shadow-sm transition-colors"
                    title={isVisible ? "Ocultar da Vitrine" : "Mostrar na Vitrine"}
                  >
                    {isVisible ? <Eye size={20} /> : <EyeOff size={20} className="text-slate-400" />}
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="bg-surface/90 backdrop-blur-sm hover:bg-red-50 text-red-500 p-2 rounded-full shadow-sm transition-colors"
                    title="Excluir Produto"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {product.fotoUrl ? (
                    <img src={product.fotoUrl} alt={product.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="text-slate-300">
                      <Package size={64} />
                    </div>
                  )}
                  {product.categoria && (
                    <span className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm text-slate-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      {product.categoria}
                    </span>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">{product.nome}</h3>
                    <p className="text-sm text-slate-500 mb-4">Margem definida: <span className="font-bold">{product.detalhesCalculo?.taxas?.margem?.toFixed(1) || product.margemLucro || 0}%</span></p>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Preço de Venda</span>
                    <span className="text-3xl font-black block" style={{ color: '#4A5D23' }}>
                      {formatCurrency(product.precoFinal)}
                    </span>
                    <div className="mt-2 flex items-center gap-1.5 text-slate-400 text-sm font-semibold" title="Custo Base de Produção (Apenas para você)">
                      <Eye size={16} />
                      <span>Custo Oculto: {formatCurrency(product.custoBase)}</span>
                    </div>
                    {!isVisible && (
                      <span className="mt-3 block text-center text-xs font-bold text-slate-400 bg-slate-100 py-1.5 rounded-lg border border-border">
                        Escondido da vitrine
                      </span>
                    )}

                    {/* Accordion: Detalhes de Custo */}
                    {hasBreakdown && (
                      <div className="mt-4">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : product.id)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-background border-2 border-border text-sm font-bold text-slate-600 hover:text-foreground hover:border-slate-300 transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <Receipt size={16} className="text-primary" />
                            Raio-X do Custo
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}
                        >
                          <div className="bg-background rounded-xl border-2 border-border p-4">
                            <CostReceipt
                              items={buildBreakdownFromDetails(product.detalhesCalculo!, product.precoFinal)}
                              total={product.precoFinal}
                            />
                            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-600">Preço Final</span>
                              <span className="text-lg font-black" style={{ color: '#4A5D23' }}>{formatCurrency(product.precoFinal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}

      </div>
    </div>
  );
}
