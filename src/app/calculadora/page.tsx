'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, writeBatch, doc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Save, Calculator, Receipt, DollarSign, Clock, Scissors, Lightbulb, Settings, ShoppingCart, User as UserIcon, ImageIcon, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { uploadImage } from '@/app/actions/upload-image';
import { fetchUserLimitsAction } from '@/app/actions/user';
import LimitModal from '@/components/LimitModal';

interface Material {
  id: string;
  nome: string;
  custo: string;
  quantidade: string; // Nova propriedade para a quantidade gasta
  estoqueId?: string;
}

interface Ferramenta {
  id: string;
  nome: string;
  valorCompra: string;
  vidaUtil: string;
  tempoUso: string;
  custo: string;
  custoDesgaste?: string;
  equipamentoId?: string;
}

interface ItemEstoque {
  id: string;
  nome: string;
  custo: number;
  quantidadeAtual: number; // Para controle de baixa
  unidadeMedida: string;
}

interface ItemEquipamento {
  id: string;
  nome: string;
  custoDesgaste: number;
}

// Cabeçalho numerado de cada passo — guia a artesã pela ordem de preenchimento.
function StepHeader({ num, title, subtitle }: { num: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <span className="w-10 h-10 rounded-xl bg-primary text-slate-900 font-black flex items-center justify-center text-xl shrink-0 shadow-sm">
        {num}
      </span>
      <div>
        <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

const inputBase = "w-full px-4 py-3 text-lg font-bold text-slate-800 rounded-xl border-2 border-border bg-surface focus:border-primary focus:outline-none transition-colors placeholder:font-medium placeholder:text-slate-400";

export default function CalculadoraPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [isRounded, setIsRounded] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Listas do BD
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([]);
  const [itensEquipamento, setItensEquipamento] = useState<ItemEquipamento[]>([]);
  const [clientesDb, setClientesDb] = useState<any[]>([]); // Array para Clientes reais
  const [userLimits, setUserLimits] = useState<any>(null);

  // 1. Identificação
  const [nomeDaPeca, setNomeDaPeca] = useState('');
  const [fotoDaPeca, setFotoDaPeca] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  // 2. Mão de Obra (agora centralizado no Perfil, com fallback de 160h)
  const [proLabore, setProLabore] = useState('');
  const [horasMes, setHorasMes] = useState('');
  const [tempoHoras, setTempoHoras] = useState('');
  const [tempoMinutos, setTempoMinutos] = useState('');
  
  // 3. Materiais e Equipamentos
  // Adicionamos custoUnitario para permitir multiplicar pela quantidade
  const [materiais, setMateriais] = useState<any[]>([{ id: '1', nome: '', custo: '', quantidade: '1', isEstoque: false, custoUnitario: 0 }]);
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([{ id: '1', nome: '', valorCompra: '', vidaUtil: '', tempoUso: '', custo: '0' }]);
  
  // 4. Custos Fixos e Embalagens
  const [aluguel, setAluguel] = useState('0');
  const [aguaLuz, setAguaLuz] = useState('0');
  const [internet, setInternet] = useState('0');
  const [embalagens, setEmbalagens] = useState('0');

  // 5. Taxas e Margem
  const [margemLucro, setMargemLucro] = useState('30');
  const [taxaMaquininha, setTaxaMaquininha] = useState('0');
  const [comissaoPlataforma, setComissaoPlataforma] = useState('0');
  const [imposto, setImposto] = useState('0');

  // Estado Modal Venda
  const [nomeCliente, setNomeCliente] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        toast.error('Por favor, faça login.');
        router.push('/login');
      } else {
        setUser(currentUser);
        
        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.proLabore) setProLabore(data.proLabore);
            if (data.horasMes) setHorasMes(data.horasMes);
            else setHorasMes('160'); // Fallback explícito caso não tenha preenchido no perfil
          }
        } catch (error) {
          console.error("Erro ao carregar perfil do usuário:", error);
        }

        await Promise.all([
          carregarEstoque(currentUser.uid),
          carregarEquipamentos(currentUser.uid),
          carregarClientes(currentUser.uid)
        ]);

        try {
          const limitsData = await fetchUserLimitsAction(currentUser.uid);
          setUserLimits(limitsData);
        } catch (e) {
          console.error(e);
        }

        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const carregarEstoque = async (userId: string) => {
    try {
      const q = query(collection(db, 'estoque'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const items: ItemEstoque[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        items.push({ 
          id: docSnap.id, 
          nome: data.nome || data.name || 'Sem Nome', 
          unidadeMedida: data.unidadeMedida || data.unit || 'un',
          custo: parseFloat(data.custoTotal || data.valor || data.price || data.custo || data.preco || 0),
          quantidadeAtual: parseFloat(data.quantidadeTotal || data.quantidade || data.quantity || 1)
        });
      });
      setItensEstoque(items);
    } catch (error) {
      console.error('Erro estoque:', error);
    }
  };

  const carregarEquipamentos = async (userId: string) => {
    try {
      const q = query(collection(db, 'equipamentos'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const items: ItemEquipamento[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        items.push({ id: docSnap.id, nome: data.nome, custoDesgaste: data.custoDesgaste || 0 });
      });
      setItensEquipamento(items);
    } catch (error) {
      console.error('Erro equipamentos:', error);
    }
  };

  const carregarClientes = async (userId: string) => {
    try {
      const q = query(collection(db, 'clientes'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const items: any[] = [];
      snap.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Ordena por nome
      items.sort((a, b) => a.name?.localeCompare(b.name));
      setClientesDb(items);
    } catch (error) {
      console.error('Erro clientes:', error);
    }
  };

  // --- CÁLCULOS MATEMÁTICOS ---
  const parsedProLabore = parseFloat(proLabore) || 0;
  // Fallback de segurança matemático (160h) para evitar divisão por zero/NaN
  const parsedHorasMes = parseFloat(horasMes) || 160;
  const valorHoraCalculado = parsedProLabore / parsedHorasMes;

  const parsedHoras = parseFloat(tempoHoras) || 0;
  const parsedMinutos = parseFloat(tempoMinutos) || 0;
  const custoMaoDeObra = ((parsedHoras * 60) + parsedMinutos) * (valorHoraCalculado / 60);
  
  const custoMateriais = materiais.reduce((acc, mat) => {
    const qty = parseFloat(mat.quantidade) || 0;
    // Se for do estoque, multiplica o custo base (já calculado) pela quantidade gasta.
    const custoItem = mat.isEstoque 
      ? (qty * (parseFloat(mat.valorBaseUnidade) || 0)) 
      : (parseFloat(mat.custo) || 0);
    return acc + custoItem;
  }, 0);

  const custoFerramentas = ferramentas.reduce((acc, fer) => {
    const vc = parseFloat(fer.valorCompra) || 0;
    const vu = parseFloat(fer.vidaUtil) || 1;
    const tu = parseFloat(fer.tempoUso) || 0;
    const custoCalc = fer.equipamentoId ? (parseFloat(fer.custoDesgaste || '0') * tu) : ((vc / vu) * tu);
    return acc + custoCalc;
  }, 0);
  const custoFixoMensal = (parseFloat(aluguel) || 0) + (parseFloat(aguaLuz) || 0) + (parseFloat(internet) || 0);
  const tempoTotalEmHoras = parsedHoras + (parsedMinutos / 60);
  const custoFixoTotal = (custoFixoMensal / parsedHorasMes) * tempoTotalEmHoras;
  const custoEmbalagens = parseFloat(embalagens) || 0;
  
  const custoBaseTotal = custoMaoDeObra + custoMateriais + custoFerramentas + custoFixoTotal + custoEmbalagens;
  
  const margem = parseFloat(margemLucro) || 0;
  const maquininha = parseFloat(taxaMaquininha) || 0;
  const plataforma = parseFloat(comissaoPlataforma) || 0;
  const imp = parseFloat(imposto) || 0;
  const somaPercentuais = margem + maquininha + plataforma + imp;

  const divisorMarkup = 1 - (somaPercentuais / 100);
  const precoIdealVenda = divisorMarkup > 0 ? (custoBaseTotal / divisorMarkup) : 0;
  const precoFinalVenda = isRounded ? Math.ceil(precoIdealVenda) : precoIdealVenda;
  const lucroAtelie = precoFinalVenda * (margem / 100);

  // --- FUNÇÕES DE LISTAS ---
  const handleMaterialChange = (id: string, campo: string, valor: string) => {
    setMateriais(materiais.map(m => {
      if (m.id !== id) return m;
      
      const newM = { ...m, [campo]: valor };
      if (campo === 'estoqueId') {
        if (valor === 'manual') {
          newM.isEstoque = false;
          newM.estoqueId = '';
          newM.nome = '';
          newM.custo = '';
          newM.custoUnitario = 0;
          newM.unidadeMedida = '';
          newM.custoTotalEstoque = 0;
          newM.quantidadeTotalEstoque = 0;
          newM.valorBaseUnidade = 0;
        } else {
          const itemBd = itensEstoque.find(i => i.id === valor);
          if (itemBd) {
            const custoItem = parseFloat(itemBd.custo as any) || 0;
            const qtdItem = parseFloat(itemBd.quantidadeAtual as any) || 1;
            
            newM.isEstoque = true;
            newM.nome = itemBd.nome;
            newM.unidadeMedida = itemBd.unidadeMedida;
            newM.custoTotalEstoque = custoItem;
            newM.quantidadeTotalEstoque = qtdItem;
            newM.valorBaseUnidade = custoItem / qtdItem;
            newM.custoUnitario = newM.valorBaseUnidade;
            newM.custo = custoItem.toString(); // Apenas como referência visual
          }
        }
      }
      return newM;
    }));
  };

  const handleFerramentaChange = (id: string, campo: string, valor: string) => {
    setFerramentas(ferramentas.map(f => {
      if (f.id !== id) return f;
      
      const newF = { ...f, [campo]: valor };
      if (campo === 'equipamentoId') {
        if (valor === '') {
          newF.nome = '';
          newF.custoDesgaste = '0';
        } else {
          const itemBd = itensEquipamento.find(i => i.id === valor);
          if (itemBd) {
            newF.nome = itemBd.nome;
            newF.custoDesgaste = itemBd.custoDesgaste.toString();
          }
        }
      }
      return newF;
    }));
  };

  // --- SALVAMENTOS ---
  const getPayloadBase = () => ({
    nome: nomeDaPeca || 'Peça sem nome',
    precoFinal: precoFinalVenda,
    custoBase: custoBaseTotal,
    lucroReal: lucroAtelie,
    userId: user!.uid,
    createdAt: new Date().toISOString(),
    fotoUrl: fotoDaPeca,
    detalhesCalculo: {
      maoDeObra: custoMaoDeObra,
      materiais: materiais.filter(m => m.nome.trim() || m.custo),
      ferramentas: ferramentas.filter(f => f.nome.trim() || f.custo),
      custosFixos: custoFixoTotal,
      embalagens: custoEmbalagens,
      taxas: { margem, maquininha, plataforma, imposto }
    }
  });

  const salvarNoCatalogo = async () => {
    if (!user) return;
    if (precoFinalVenda <= 0) {
      toast.error('O preço final não pode ser zero ou negativo.');
      return;
    }
    setIsSaving(true);
    const loadingToast = toast.loading('Salvando no catálogo...');
    try {
      const payload = getPayloadBase();
      // Import dynamic or just use fetch if we want, but since it's a client component and we can import server actions:
      const { addCatalogItem } = await import('@/app/actions/erp');
      const result = await addCatalogItem(payload);
      
      if (!result.success) {
        if (result.error === 'LIMIT_REACHED_PRODUCTS') {
          toast.dismiss(loadingToast);
          setShowLimitModal(true);
        } else {
          toast.error(result.error || 'Erro ao salvar.', { id: loadingToast });
        }
        return;
      }
      
      toast.success('Peça salva no catálogo!', { id: loadingToast });
    } catch (error) {
      toast.error('Erro ao salvar.', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const limparCalculadora = () => {
    setNomeDaPeca('');
    setFotoDaPeca('');
    setTempoHoras('');
    setTempoMinutos('');
    setMateriais([{ id: Date.now().toString(), nome: '', custo: '', quantidade: '1' }]);
    setFerramentas([{ id: Date.now().toString(), nome: '', valorCompra: '', vidaUtil: '', tempoUso: '', custo: '0' }]);
  };

  const [statusPedido, setStatusPedido] = useState<'queue' | 'production' | 'finished'>('finished');

  const salvarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Alertas de estoque negativo (aviso prévio)
    const alertasEstoque = materiais
      .filter(m => m.estoqueId)
      .map(m => {
        const itemDb = itensEstoque.find(i => i.id === m.estoqueId);
        const qtdGasta = parseFloat(m.quantidade) || 0;
        if (itemDb && (itemDb.quantidadeAtual - qtdGasta < 0)) {
          return `${m.nome} ficará com estoque negativo.`;
        }
        return null;
      })
      .filter(Boolean);
      
    if (alertasEstoque.length > 0) {
      toast.error(`Atenção: ${alertasEstoque[0]} A venda prosseguirá mesmo assim.`, { duration: 4000 });
    }

    setIsSelling(true);
    const loadingToast = toast.loading('Gerando pedido e baixando estoque...');
    
    try {
      const batch = writeBatch(db);
      const dataAtualIso = new Date().toISOString();
      
      let paymentStatus = 'pending';
      let paidValue = 0;
      let remainingValue = precoFinalVenda;

      if (statusPedido === 'finished') {
        paymentStatus = 'paid';
        paidValue = precoFinalVenda;
        remainingValue = 0;
      }
      
      // 1. Gravar a Venda na coleção 'pedidos' (Single Source of Truth)
      const novaVendaRef = doc(collection(db, 'pedidos'));
      
      const pedido = {
        userId: user.uid,
        cliente: nomeCliente.trim() || 'Cliente Balcão',
        produto: nomeDaPeca || 'Peça sem nome',
        valor: precoFinalVenda,
        custo: custoBaseTotal,
        lucro: lucroAtelie,
        status: statusPedido === 'queue' ? 'pendente' : statusPedido === 'production' ? 'em_producao' : 'concluido',
        data: dataAtualIso,
        createdAt: serverTimestamp() 
      };
      
      batch.set(novaVendaRef, pedido);

      // 2. Gravar Transação Financeira na coleção 'transactions' APENAS se estiver pago
      if (statusPedido === 'finished') {
        const novaTransacaoRef = doc(collection(db, 'transactions'));
        batch.set(novaTransacaoRef, {
          orderId: novaVendaRef.id,
          amount: precoFinalVenda,
          type: 'integral',
          userId: user.uid,
          createdAt: dataAtualIso
        });
      }

      // 3. Baixa Automática no Estoque
      materiais.forEach((mat) => {
        if (mat.estoqueId) {
          const qtdGasta = parseFloat(mat.quantidade) || 0;
          if (qtdGasta > 0) {
            const estoqueRef = doc(db, 'estoque', mat.estoqueId);
            batch.update(estoqueRef, {
              quantidade: increment(-qtdGasta)
            });
          }
        }
      });

      // 4. Executar o batch
      await batch.commit();

      toast.success('Pedido registrado com sucesso!', { id: loadingToast });
      setShowVendaModal(false);
      setNomeCliente('');
      setStatusPedido('finished');
      
      // 5. Limpar o formulário
      limparCalculadora();
      await carregarEstoque(user.uid);

    } catch (error) {
      console.error('Erro na transação unificada:', error);
      toast.error('Erro ao registrar pedido.', { id: loadingToast });
    } finally {
      setIsSelling(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground flex items-center gap-3 tracking-tight">
              <Calculator className="text-primary" size={34} />
              Calculadora de Preço
            </h1>
            <p className="text-slate-600 mt-2 text-lg font-medium">
              Siga os 6 passos e descubra o preço que paga seus custos e garante o seu lucro.
            </p>
          </div>
          <button
            onClick={() => router.push('/equipamentos')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-surface border-2 border-border text-slate-600 font-bold rounded-xl hover:bg-background hover:text-foreground transition-colors"
          >
            <Settings size={18} />
            Gerenciar Equipamentos
          </button>
        </div>

        {userLimits && !userLimits.isPro && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-amber-800 font-bold text-sm">Plano Grátis: Limite de Peças Salvas no Catálogo</p>
              <p className="text-amber-700 text-xs mt-1">Você usou {userLimits.usage.savedProducts} de {userLimits.limits.savedProducts} produtos.</p>
            </div>
            {userLimits.usage.savedProducts >= userLimits.limits.savedProducts && (
              <button onClick={() => router.push('/perfil')} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm">
                Fazer Upgrade
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          <div className="xl:col-span-8 space-y-6">
            
            {/* Passo 1: Identificação */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <StepHeader num={1} title="Qual peça você vai precificar?" subtitle="Dê um nome (e uma foto, se quiser) para identificar a peça." />
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-full md:flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Peça</label>
                  <input
                    type="text"
                    value={nomeDaPeca}
                    onChange={(e) => setNomeDaPeca(e.target.value)}
                    placeholder="Ex: Necessaire de Tecido, Vaso de Cerâmica..."
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Foto da Peça (opcional)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl border-2 border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                      {isUploadingPhoto ? (
                        <Loader2 className="animate-spin text-primary" size={24} />
                      ) : fotoDaPeca ? (
                        <img src={fotoDaPeca} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-slate-400" size={24} />
                      )}
                    </div>
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg transition-colors border border-border text-sm">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        disabled={isUploadingPhoto}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingPhoto(true);
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const response = await uploadImage(formData) as any;
                            if (response.success && response.secure_url) {
                              setFotoDaPeca(response.secure_url);
                              toast.success('Imagem carregada!');
                            } else {
                              toast.error(response.error || 'Erro ao enviar a imagem.');
                            }
                          } catch (err) {
                            console.error(err);
                            toast.error('Ocorreu um erro no upload.');
                          } finally {
                            setIsUploadingPhoto(false);
                          }
                        }}
                      />
                      {isUploadingPhoto ? 'Enviando...' : (fotoDaPeca ? 'Trocar' : 'Adicionar Foto')}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Passo 2: Mão de Obra */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                <StepHeader num={2} title="Quanto tempo você gastou?" subtitle="Seu tempo vale dinheiro — ele entra no preço como mão de obra." />
                <button
                  onClick={() => router.push('/perfil')}
                  className="text-sm text-slate-500 hover:text-foreground font-bold flex items-center gap-1 shrink-0 bg-background border-2 border-border px-3 py-2 rounded-xl transition-colors"
                >
                  <Settings size={16} /> Editar salário no Perfil
                </button>
              </div>

              <div className="bg-background p-4 rounded-xl border-2 border-border mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Seu Salário / Mês</p>
                    <p className="text-lg font-black text-slate-800">{parsedProLabore > 0 ? formatCurrency(parsedProLabore) : 'R$ 0,00'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Carga Horária</p>
                    <p className="text-lg font-black text-slate-800">{parsedHorasMes}h / mês</p>
                  </div>
                </div>
                <div className="bg-surface px-5 py-3 rounded-xl border-2 border-primary/40 shadow-sm text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Custo da sua Hora</p>
                  <p className="text-xl font-black text-primary">{formatCurrency(valorHoraCalculado)}/h</p>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tempo gasto nesta peça:</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="number" min="0" value={tempoHoras} onChange={(e) => setTempoHoras(e.target.value)}
                      placeholder="0" className={`${inputBase} text-center text-2xl`}
                    />
                    <p className="text-center text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Horas</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number" min="0" max="59" value={tempoMinutos} onChange={(e) => setTempoMinutos(e.target.value)}
                      placeholder="0" className={`${inputBase} text-center text-2xl`}
                    />
                    <p className="text-center text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Minutos</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Passo 3: Materiais */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <StepHeader num={3} title="O que você usou para fazer a peça?" subtitle="Escolha do seu estoque (o custo vem sozinho) ou digite manualmente." />
              <div className="space-y-3 mb-4">
                {materiais.map((mat) => (
                  <div key={mat.id} className="flex flex-col sm:flex-row gap-2 items-start">
                    <select
                      value={mat.isEstoque ? (mat.estoqueId || '') : 'manual'}
                      onChange={(e) => handleMaterialChange(mat.id, 'estoqueId', e.target.value)}
                      className="w-full sm:w-1/3 px-3 py-2.5 rounded-lg border border-border bg-surface text-sm"
                    >
                      <option value="manual">Digitar nome manual...</option>
                      <optgroup label="Seu Estoque">
                        {itensEstoque.map(i => (
                          <option key={i.id} value={i.id}>{i.nome} ({i.unidadeMedida})</option>
                        ))}
                      </optgroup>
                    </select>
                    
                    {!mat.isEstoque && (
                      <input
                        type="text" value={mat.nome} onChange={(e) => handleMaterialChange(mat.id, 'nome', e.target.value)}
                        placeholder="Nome do material"
                        className="w-full sm:flex-1 px-3 py-2.5 rounded-lg border border-border text-sm"
                      />
                    )}

                    <div className="flex gap-2 w-full sm:w-auto items-center">
                      <input
                        type="number" min="0" step="0.01" value={mat.quantidade} onChange={(e) => handleMaterialChange(mat.id, 'quantidade', e.target.value)}
                        placeholder={mat.isEstoque ? `Qtd. (${mat.unidadeMedida || 'un'})` : "Qtd."}
                        title="Quantidade Utilizada"
                        className="w-full sm:w-24 px-3 py-2.5 rounded-lg border border-border text-sm"
                      />
                      
                      {!mat.isEstoque ? (
                        <input
                          type="number" min="0" step="0.01" value={mat.custo} onChange={(e) => handleMaterialChange(mat.id, 'custo', e.target.value)}
                          placeholder="Custo (R$)"
                          className="w-full sm:w-24 px-3 py-2.5 rounded-lg border border-border text-sm"
                        />
                      ) : (
                        <div className="flex-1 sm:w-auto px-3 py-2.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center justify-between text-center gap-2">
                          <span>Base: {formatCurrency(mat.valorBaseUnidade || 0)}/{mat.unidadeMedida || 'un'}</span>
                          <span className="text-emerald-300">|</span>
                          <span className="font-bold">Total: {formatCurrency((parseFloat(mat.quantidade) * (mat.valorBaseUnidade || 0)) || 0)}</span>
                        </div>
                      )}
                      
                      <button onClick={() => setMateriais(materiais.filter(m => m.id !== mat.id))} className="p-2.5 text-slate-400 hover:text-red-500">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setMateriais([...materiais, { id: Date.now().toString(), nome: '', custo: '', quantidade: '1', isEstoque: false, custoUnitario: 0 }])} className="text-foreground font-bold hover:text-primary flex items-center gap-1 bg-background border-2 border-border px-4 py-2.5 rounded-xl transition-colors">
                <Plus size={18} /> Adicionar Material
              </button>
            </section>

            {/* Passo 3b: Ferramentas */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <StepHeader num={4} title="Usou máquinas ou ferramentas?" subtitle="O desgaste delas também entra no custo. Pule se não usou." />
              <div className="space-y-3 mb-4">
                {ferramentas.map((fer) => {
                  const vc = parseFloat(fer.valorCompra) || 0;
                  const vu = parseFloat(fer.vidaUtil) || 1;
                  const tu = parseFloat(fer.tempoUso) || 0;
                  const custoDesgasteBase = fer.equipamentoId ? (parseFloat(fer.custoDesgaste || '0')) : (vc / vu);
                  const custoTotalFerramenta = custoDesgasteBase * tu;

                  return (
                  <div key={fer.id} className="flex flex-col sm:flex-row gap-2 items-start bg-background p-3 rounded-xl border border-border">
                    <select
                      value={fer.equipamentoId || ''}
                      onChange={(e) => handleFerramentaChange(fer.id, 'equipamentoId', e.target.value)}
                      className="w-full sm:w-1/4 px-3 py-2.5 rounded-lg border border-border bg-surface"
                    >
                      <option value="">Digitar manual...</option>
                      {itensEquipamento.map(i => (
                        <option key={i.id} value={i.id}>{i.nome}</option>
                      ))}
                    </select>
                    
                    {!fer.equipamentoId && (
                      <input
                        type="text" value={fer.nome} onChange={(e) => handleFerramentaChange(fer.id, 'nome', e.target.value)}
                        placeholder="Nome da máquina"
                        className="w-full sm:w-1/4 px-3 py-2.5 rounded-lg border border-border"
                      />
                    )}

                    {!fer.equipamentoId && (
                      <div className="flex gap-2 w-full sm:w-1/4">
                        <input
                          type="number" min="0" step="0.01" value={fer.valorCompra} onChange={(e) => handleFerramentaChange(fer.id, 'valorCompra', e.target.value)}
                          placeholder="Valor (R$)"
                          className="w-full px-3 py-2.5 rounded-lg border border-border"
                          title="Valor de Compra"
                        />
                        <input
                          type="number" min="0" step="0.01" value={fer.vidaUtil} onChange={(e) => handleFerramentaChange(fer.id, 'vidaUtil', e.target.value)}
                          placeholder="Vida Útil (h)"
                          className="w-full px-3 py-2.5 rounded-lg border border-border"
                          title="Vida Útil (em horas)"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                      <input
                        type="number" min="0" step="0.01" value={fer.tempoUso} onChange={(e) => handleFerramentaChange(fer.id, 'tempoUso', e.target.value)}
                        placeholder="Tempo Uso (h)"
                        className="w-full sm:w-28 px-3 py-2.5 rounded-lg border border-border"
                        title="Tempo de uso na peça (em horas)"
                      />
                      <div className="px-3 py-2.5 rounded-lg bg-surface border border-border text-sm font-bold text-slate-700 w-28 text-center shrink-0" title="Custo repassado">
                        {formatCurrency(custoTotalFerramenta)}
                      </div>
                      <button onClick={() => setFerramentas(ferramentas.filter(f => f.id !== fer.id))} className="p-2.5 text-slate-400 hover:text-red-500 shrink-0">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )})}
              </div>
              <button onClick={() => setFerramentas([...ferramentas, { id: Date.now().toString(), nome: '', valorCompra: '', vidaUtil: '', tempoUso: '', custo: '0' }])} className="text-foreground font-bold hover:text-primary flex items-center gap-1 bg-background border-2 border-border px-4 py-2.5 rounded-xl transition-colors">
                <Plus size={18} /> Adicionar Ferramenta
              </button>
            </section>

            {/* Passo 5: Custos Fixos e Embalagens */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <StepHeader num={5} title="Custos do ateliê e embalagem" subtitle="Uma parte proporcional do aluguel, luz e internet entra em cada peça." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Aluguel (R$)</label>
                  <input type="number" step="0.01" value={aluguel} onChange={e => setAluguel(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Água/Luz (R$)</label>
                  <input type="number" step="0.01" value={aguaLuz} onChange={e => setAguaLuz(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Internet (R$)</label>
                  <input type="number" step="0.01" value={internet} onChange={e => setInternet(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Embalagens (R$)</label>
                  <input type="number" step="0.01" value={embalagens} onChange={e => setEmbalagens(e.target.value)} className={inputBase} />
                </div>
              </div>
            </section>

            {/* Passo 6: Lucro e Taxas */}
            <section className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border-2 border-border">
              <StepHeader num={6} title="Quanto você quer ganhar?" subtitle="Defina seu lucro e as taxas que você paga. Tudo já entra embutido no preço final." />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-black text-success mb-2">Lucro Desejado (%)</label>
                  <input type="number" value={margemLucro} onChange={e => setMargemLucro(e.target.value)} className={`${inputBase} border-success/40 focus:border-success text-success`} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Maquininha (%)</label>
                  <input type="number" value={taxaMaquininha} onChange={e => setTaxaMaquininha(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Plataforma (%)</label>
                  <input type="number" value={comissaoPlataforma} onChange={e => setComissaoPlataforma(e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Imposto/MEI (%)</label>
                  <input type="number" value={imposto} onChange={e => setImposto(e.target.value)} className={inputBase} />
                </div>
              </div>

              {divisorMarkup <= 0 && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-100 text-red-600 text-sm font-bold rounded-xl">
                  Atenção: A soma das taxas e lucros não pode ser igual ou superior a 100%. Reduza os percentuais.
                </div>
              )}
            </section>
            
          </div>

          <div className="xl:col-span-4 relative">
            <div className="sticky top-8 bg-surface rounded-3xl shadow-xl overflow-hidden border-2 border-border">

              <div className="bg-secondary p-6 text-white text-center">
                <h2 className="text-xl font-black mb-1">Resultado do Preço</h2>
                <p className="text-white/70 text-sm font-medium truncate">
                  {nomeDaPeca || 'Nova Peça'}
                </p>
              </div>

              <div className="p-6 space-y-5">

                <div className="space-y-3 pb-4 border-b-2 border-border border-dashed">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Mão de Obra</span>
                    <span className="text-slate-700">{formatCurrency(custoMaoDeObra)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Materiais</span>
                    <span className="text-slate-700">{formatCurrency(custoMateriais)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Ferramentas</span>
                    <span className="text-slate-700">{formatCurrency(custoFerramentas)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Fixos & Embalagens</span>
                    <span className="text-slate-700">{formatCurrency(custoFixoTotal + custoEmbalagens)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 bg-background rounded-xl px-3 py-2.5 border border-border">
                    <span className="font-black text-slate-700 text-sm uppercase tracking-wider">Custo Total</span>
                    <span className="font-black text-slate-900 text-lg">{formatCurrency(custoBaseTotal)}</span>
                  </div>
                </div>

                <div className="bg-primary text-slate-900 p-6 rounded-2xl text-center shadow-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="block text-slate-800/70 text-xs uppercase tracking-wider font-black">
                      Venda Por
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900/10 px-2.5 py-1.5 rounded-lg hover:bg-slate-900/20 transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-wider">Arredondar</span>
                      <input type="checkbox" className="w-4 h-4 rounded accent-secondary" checked={isRounded} onChange={(e) => setIsRounded(e.target.checked)} />
                    </label>
                  </div>
                  <span className="block text-5xl font-black mt-2 tracking-tight">
                    {formatCurrency(precoFinalVenda)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-success bg-green-50 p-4 rounded-2xl border-2 border-green-100">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <DollarSign size={18} /> Fica no seu bolso ({margem}%)
                  </span>
                  <span className="font-black text-xl">{formatCurrency(lucroAtelie)}</span>
                </div>

                <div className="text-xs text-slate-400 font-medium text-center pb-2">
                  As taxas de plataforma, maquininha e impostos (Total: {somaPercentuais - margem}%) já estão embutidas no preço sugerido.
                </div>
                
                {userLimits && !userLimits.isPro && (
                  <div className="text-center mt-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${userLimits.usage.savedProducts >= userLimits.limits.savedProducts ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {userLimits.usage.savedProducts} / {userLimits.limits.savedProducts} Produtos Criados
                    </span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    onClick={salvarNoCatalogo}
                    disabled={isSaving || divisorMarkup <= 0 || (userLimits && !userLimits.isPro && userLimits.usage.savedProducts >= userLimits.limits.savedProducts)}
                    className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-hover text-white font-bold text-lg py-4 px-4 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div> : <><Save size={20} /> Salvar no Catálogo</>}
                  </button>

                  <button
                    onClick={() => setShowVendaModal(true)}
                    disabled={isSelling || divisorMarkup <= 0}
                    className="w-full flex items-center justify-center gap-2 bg-background text-foreground border-2 border-border hover:border-primary hover:text-primary font-bold text-lg py-4 px-4 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <ShoppingCart size={20} /> Gerar Pedido (Venda)
                  </button>
                </div>
                
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {showVendaModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-800 mb-1">Registrar Venda</h3>
            <p className="text-sm text-slate-500 mb-5">
              Esta venda será computada na dashboard e o estoque utilizado será reduzido.
            </p>
            
            <form onSubmit={salvarVenda}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={18} />
                  </div>
                  <select
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border focus:border-primary focus:outline-none border-2 bg-surface appearance-none"
                  >
                    <option value="Cliente Balcão / Não Cadastrado">Cliente Balcão / Não Cadastrado</option>
                    {clientesDb.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Status do Pedido</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusPedido('queue')}
                    className={`px-2 py-2 text-xs font-medium rounded-xl border flex flex-col items-center gap-1 transition-colors ${statusPedido === 'queue' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-surface border-border text-slate-500 hover:bg-background'}`}
                  >
                    <span className="text-lg">🟡</span>
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusPedido('production')}
                    className={`px-2 py-2 text-xs font-medium rounded-xl border flex flex-col items-center gap-1 transition-colors ${statusPedido === 'production' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-surface border-border text-slate-500 hover:bg-background'}`}
                  >
                    <span className="text-lg">🔵</span>
                    Em Produção
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusPedido('finished')}
                    className={`px-2 py-2 text-xs font-medium rounded-xl border flex flex-col items-center gap-1 transition-colors ${statusPedido === 'finished' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-surface border-border text-slate-500 hover:bg-background'}`}
                  >
                    <span className="text-lg">🟢</span>
                    Concluído
                  </button>
                </div>
              </div>

              <div className="bg-background p-4 rounded-xl mb-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Item:</span>
                  <span className="font-medium text-slate-700">{nomeDaPeca || 'Peça'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total:</span>
                  <span className="font-black text-primary">{formatCurrency(precoFinalVenda)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowVendaModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSelling}
                  className="flex-1 px-4 py-3 bg-primary hover:bg-primary-hover text-slate-900 rounded-xl font-bold transition-colors flex justify-center items-center"
                >
                  {isSelling ? <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div> : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <LimitModal 
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)} 
        itemName="Peças no Catálogo" 
      />
    </div>
  );
}
