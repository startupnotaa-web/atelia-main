'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  fetchClientsForQuotes,
  fetchProductsForQuotes,
  registerPdfGeneration,
  criarOrcamento,
  fetchArtisanProfileForQuotes,
} from '@/app/actions/quotes';
import type { QuoteClient, QuoteProduct, ArtisanProfile } from '@/app/actions/quotes';
import toast from 'react-hot-toast';
import { fetchUserLimitsAction } from '@/app/actions/user';
import LimitModal from '@/components/LimitModal';
import { roundCents } from '@/lib/pricingEngine';

// @react-pdf/renderer usa APIs de navegador (Blob/URL.createObjectURL) — precisa
// ficar fora do bundle de SSR, senão o build do Node tenta resolver o módulo errado.
const OrcamentoActions = dynamic(() => import('@/components/pdf/OrcamentoActions'), { ssr: false });

const EMPTY_ARTISAN_PROFILE: ArtisanProfile = { brandName: '', email: '', telefone: '', logoUrl: '' };

type OrcamentoItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Custo de produção unitário (catalogo.custoBase) — segue no orçamento até a conversão em pedido. */
  unitCost: number;
  total: number;
};

export default function GerarOrcamento() {
  // State
  const [clientes, setClientes] = useState<QuoteClient[]>([]);
  const [catalog, setCatalog] = useState<QuoteProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState<QuoteClient | null>(null);
  const [items, setItems] = useState<OrcamentoItem[]>([]);
  const [userLimits, setUserLimits] = useState<any>(null);
  const [artisanProfile, setArtisanProfile] = useState<ArtisanProfile>(EMPTY_ARTISAN_PROFILE);

  const [desconto, setDesconto] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');

  const [showLimitModal, setShowLimitModal] = useState(false);

  // Orçamento já persistido no Firestore, e a "assinatura" dos dados que ele
  // representa — evita duplicar o registro a cada novo clique em "Baixar
  // PDF"/"Enviar por WhatsApp" para o mesmo orçamento, mas salva de novo se
  // cliente/itens/desconto/prazo mudarem. Comparado durante o render (não via
  // efeito) para não disparar um setState síncrono dentro de um useEffect.
  const [savedOrcamento, setSavedOrcamento] = useState<{ id: string; signature: string } | null>(null);
  const orcamentoSignature = JSON.stringify({
    clientId: selectedClient?.id,
    items: items.map(i => ({ id: i.id, quantity: i.quantity, unitPrice: i.unitPrice, unitCost: i.unitCost })),
    desconto,
    prazoEntrega,
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const fetchedClients = await fetchClientsForQuotes(user.uid);
            if (fetchedClients.length === 0) {
              console.log("Nenhum cliente encontrado no banco.");
            }
            setClientes(fetchedClients);
            
            const fetchedProducts = await fetchProductsForQuotes(user.uid);
            if (fetchedProducts.length === 0) {
              console.log("Nenhum produto encontrado no banco.");
            }
            setCatalog(fetchedProducts);

            try {
              const limits = await fetchUserLimitsAction(user.uid);
              setUserLimits(limits);
            } catch (e) {}

            try {
              const profile = await fetchArtisanProfileForQuotes(user.uid);
              setArtisanProfile(profile);
            } catch (e) {}

          } catch (e) {
            console.error("Erro ao carregar dados:", e);
          }
        }
        setIsLoading(false);
      });
      return () => unsubscribe();
    };
    fetchData();
  }, []);

  const totalGeral = items.reduce((acc, item) => acc + item.total, 0);
  const valorDesconto = Number(desconto.replace(/\D/g, '')) / 100 || 0; 
  const totalComDesconto = Math.max(0, totalGeral - valorDesconto);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleClientSelect = (clientId: string) => {
    const client = clientes.find(c => c.id === clientId);
    setSelectedClient(client || null);
  };

  const handleProductSelect = (productId: string) => {
    const product = catalog.find(p => p.id === productId);
    if (!product) return;
    
    // Check se já existe
    const exists = items.find(i => i.id === product.id);
    if (exists) {
      setItems(items.map(it => it.id === product.id ? { ...it, quantity: it.quantity + 1, total: (it.quantity + 1) * it.unitPrice } : it));
    } else {
      const newItem: OrcamentoItem = {
        id: product.id,
        name: product.nome,
        quantity: 1,
        unitPrice: product.precoFinal,
        unitCost: product.custoBase,
        total: product.precoFinal
      };
      setItems([...items, newItem]);
    }
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setItems(items.map(it => {
      if (it.id === id) {
        const newQty = Math.max(1, it.quantity + delta);
        return { ...it, quantity: newQty, total: newQty * it.unitPrice };
      }
      return it;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(it => it.id !== id));
  };

  /**
   * Roda antes de liberar o download do PDF: checa o limite do plano e
   * persiste o orçamento no Firestore — sem isso ele vira um PDF solto, sem
   * histórico e sem caminho de conversão em pedido (INTEGRATION_BLUEPRINT.md
   * §2.7). Resolve `true` quando o download pode prosseguir.
   */
  const preflightAndPersistOrcamento = async (): Promise<boolean> => {
    if (!selectedClient) return false;

    const user = auth.currentUser;
    if (!user) {
      toast.error('Usuário não autenticado.');
      return false;
    }

    const result = await registerPdfGeneration(user.uid);
    if (!result.success) {
      if (result.error === 'LIMIT_REACHED_PDF') {
        setShowLimitModal(true);
      } else {
        toast.error(result.error || 'Erro ao registrar PDF.');
      }
      return false;
    }

    // Não bloqueia o download se a persistência falhar.
    if (!savedOrcamento || savedOrcamento.signature !== orcamentoSignature) {
      const custoTotal = roundCents(items.reduce((acc, item) => acc + item.unitCost * item.quantity, 0));
      const orcamentoResult = await criarOrcamento({
        userId: user.uid,
        clienteId: selectedClient.id,
        clienteNome: selectedClient.name,
        clienteTelefone: selectedClient.phone,
        itens: items.map(item => ({
          produtoId: item.id,
          nome: item.name,
          quantidade: item.quantity,
          precoUnitario: item.unitPrice,
          custoUnitario: item.unitCost,
        })),
        desconto: valorDesconto,
        prazoEntregaDias: prazoEntrega ? Number(prazoEntrega) : undefined,
        valorFinal: totalComDesconto,
        custoTotal,
      });
      if (orcamentoResult.success && orcamentoResult.id) {
        setSavedOrcamento({ id: orcamentoResult.id, signature: orcamentoSignature });
      } else {
        console.error('Falha ao salvar orçamento:', orcamentoResult.error);
        toast.error('O orçamento não pôde ser salvo no histórico, mas o PDF será gerado normalmente.');
      }
    }

    return true;
  };

  const openWhatsAppChat = () => {
    if (!selectedClient) return;
    const itemListText = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    const msg = `Olá ${selectedClient.name}, tudo bem? Aqui está o resumo do seu orçamento.\n\nItens: ${itemListText}.\nTotal: ${formatCurrency(totalComDesconto)}.\n\nO PDF detalhado segue logo abaixo. Fico à disposição para qualquer dúvida!`;
    const encodedMsg = encodeURIComponent(msg);
    const num = (selectedClient.phone || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/55${num}?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  const canExport = selectedClient && items.length > 0;

  return (
    <div className="w-full flex flex-col items-center pb-20 px-4">
      
      <div className="w-full max-w-4xl mb-8">
        <h1 className="text-4xl font-black text-foreground mb-2">Gerador de Orçamentos</h1>
        <p className="text-slate-600 font-medium">Crie propostas integradas ao seu banco de dados em segundos.</p>
      </div>

      <div className="w-full max-w-4xl bg-surface p-8 rounded-[2rem] border border-border shadow-sm space-y-10 mb-8">
        
        {/* Etapa 1: Cliente */}
        <div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold">1</div>
             <h2 className="text-2xl font-bold text-slate-800">Cliente</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
             <select 
                className="flex-1 p-4 border-2 border-border rounded-xl font-bold text-slate-700 bg-background focus:border-secondary"
                value={selectedClient?.id || ''}
                onChange={e => handleClientSelect(e.target.value)}
             >
                <option value="" disabled>
                  {isLoading ? 'Carregando clientes...' : 'Selecione um cliente...'}
                </option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
             </select>
          </div>
          {!isLoading && clientes.length === 0 && (
             <p className="mt-2 text-sm text-amber-600 font-bold">Você não possui clientes cadastrados ainda.</p>
          )}
        </div>

        {/* Etapa 2: Itens */}
        <div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold">2</div>
             <h2 className="text-2xl font-bold text-slate-800">Itens do Orçamento</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
             <select 
                className="flex-1 p-4 border-2 border-border rounded-xl font-bold text-slate-700 bg-background focus:border-secondary"
                value=""
                onChange={e => handleProductSelect(e.target.value)}
             >
                <option value="" disabled>
                  {isLoading ? 'Carregando produtos...' : '+ Adicionar produto do catálogo'}
                </option>
                {catalog.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} - {formatCurrency(p.precoFinal)}</option>
                ))}
             </select>
          </div>
          {!isLoading && catalog.length === 0 && (
             <p className="mb-4 text-sm text-amber-600 font-bold">Você não possui produtos no catálogo.</p>
          )}

          <div className="space-y-4">
             {items.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row justify-between items-center bg-background p-4 rounded-xl border border-border gap-4">
                   <span className="font-bold text-slate-800 flex-1 truncate w-full">{item.name}</span>
                   <div className="flex items-center gap-4">
                      <span className="text-slate-500 text-sm font-bold">{formatCurrency(item.unitPrice)}</span>
                      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1 shadow-sm">
                        <button onClick={() => handleUpdateQuantity(item.id, -1)} className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold">-</button>
                        <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                        <button onClick={() => handleUpdateQuantity(item.id, 1)} className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold">+</button>
                      </div>
                      <span className="font-black text-foreground w-24 text-right">{formatCurrency(item.total)}</span>
                      <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-2"><X size={20} /></button>
                   </div>
                </div>
             ))}
          </div>
        </div>

        {/* Etapa 3: Resumo */}
        <div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold">3</div>
             <h2 className="text-2xl font-bold text-slate-800">Resumo</h2>
          </div>

          <div className="bg-primary/10 border-2 border-[#FFAA00]/30 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Desconto (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input type="text" value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="0,00" className="w-full pl-12 p-3 border-2 border-white rounded-lg font-bold bg-surface focus:border-primary" />
                </div>
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Prazo de Entrega (dias)</label>
                <input type="number" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Ex: 15" className="w-full p-3 border-2 border-white rounded-lg font-bold bg-surface focus:border-primary" />
             </div>
             <div className="flex flex-col items-end justify-center pt-4 sm:pt-0">
                <span className="text-sm font-bold text-slate-500 uppercase">Total Final</span>
                <span className="text-4xl font-black text-foreground">{formatCurrency(totalComDesconto)}</span>
             </div>
          </div>
        </div>

      </div>

      {userLimits && !userLimits.isPro && (
        <div className="w-full max-w-4xl mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-amber-800 font-bold text-sm">Plano Grátis: Limite de PDFs gerados no mês</p>
            <p className="text-amber-700 text-xs mt-1">Você gerou {userLimits.usage.generatedPdfs} de {userLimits.limits.generatedPdfs} PDFs gratuitos deste mês.</p>
          </div>
          {userLimits.usage.generatedPdfs >= userLimits.limits.generatedPdfs && (
            <button onClick={() => window.location.href = '/perfil'} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0 text-center">
              Fazer Upgrade
            </button>
          )}
        </div>
      )}

      {/* BOTÕES DE AÇÃO FINAL */}
      {canExport && selectedClient && (
        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4">
          <OrcamentoActions
            pdfProps={{
              orcamentoId: savedOrcamento?.id,
              artisan: artisanProfile,
              clienteNome: selectedClient.name,
              clienteTelefone: selectedClient.phone,
              itens: items.map(item => ({
                nome: item.name,
                quantidade: item.quantity,
                valorUnitario: item.unitPrice,
                subtotal: item.total,
              })),
              desconto: valorDesconto,
              prazoEntregaDias: prazoEntrega ? Number(prazoEntrega) : undefined,
              valorFinal: totalComDesconto,
            }}
            fileName={`Orcamento_${selectedClient.name.replace(/\s+/g, '_')}.pdf`}
            onBeforeDownload={preflightAndPersistOrcamento}
            disabled={!!(userLimits && !userLimits.isPro && userLimits.usage.generatedPdfs >= userLimits.limits.generatedPdfs)}
            onWhatsAppShare={openWhatsAppChat}
            whatsappDisabled={!selectedClient.phone}
          />
        </div>
      )}

      <LimitModal
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)} 
        itemName="Orçamentos em PDF" 
      />
    </div>
  );
}
