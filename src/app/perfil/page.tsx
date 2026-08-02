'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { 
  Save, Copy, Store, Image as ImageIcon, User, Crown, Key, 
  LogOut, Loader2, Check, Building2, LinkIcon, AtSign,
  Calendar, Phone, MapPin, CreditCard, Shield, ExternalLink, Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useTenant } from '@/lib/TenantProvider';
import { uploadImage } from '@/app/actions/upload-image';
import { extractFirstName, getGreetings } from '@/utils/greetings';
import type { PronounType } from '@/utils/greetings';

export default function PerfilPage() {
  const router = useRouter();
  const { isPro, currentPlan, userId } = useTenant();

  // State: dados pessoais
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [instagram, setInstagram] = useState('');
  const [selectedPronoun, setSelectedPronoun] = useState<PronounType>('ela');

  // State: dados da empresa
  const [brandName, setBrandName] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Financeiro
  const [proLabore, setProLabore] = useState('');
  const [horasMes, setHorasMes] = useState('160');
  const [monthlyGoal, setMonthlyGoal] = useState('');

  // State: vitrine
  const [vitrineSlug, setVitrineSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // State: UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pessoal' | 'empresa' | 'vitrine' | 'plano' | 'seguranca'>('pessoal');

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserEmail(user.email || '');
        setUserName(user.displayName || '');
        try {
          // Busca dados do perfil (coleção perfis)
          const perfilRef = doc(db, 'perfis', user.uid);
          const perfilSnap = await getDoc(perfilRef);
          if (perfilSnap.exists()) {
            const data = perfilSnap.data();
            setBrandName(data.brandName || '');
            setVitrineSlug(data.lojaUrl || '');
            setWhatsapp(data.whatsapp || '');
            setLogoUrl(data.logoUrl || '');
            if (data.lojaUrl) setIsSlugManuallyEdited(true);
          }

          // Busca dados extras do usuário (coleção users)
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserName(data.nome || data.displayName || user.displayName || '');
            setDataNascimento(data.dataNascimento || '');
            setTelefone(data.telefone || '');
            setComoConheceu(data.comoConheceu || '');
            setInstagram(data.instagram || '');
            setSelectedPronoun((data.pronoun as PronounType) || 'ela');
            setProLabore(data.proLabore || '');
            setHorasMes(data.horasMes || '160');
            setMonthlyGoal(data.monthlyGoal || '');
            setCnpjCpf(data.cnpjCpf || '');
            setEndereco(data.endereco || '');
            setCidade(data.cidade || '');
            setEstado(data.estado || '');
            setCep(data.cep || '');
          }
        } catch (error) {
          console.error("Erro ao buscar perfil:", error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid || userId;

    if (!uid) {
      toast.error(`Você precisa estar logado(a).`);
      return;
    }
    
    const cleanSlug = (vitrineSlug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    setSaving(true);
    try {
      if (cleanSlug) {
        // Verifica se o slug já existe para outro usuário
        const slugQuery = query(collection(db, 'perfis'), where('lojaUrl', '==', cleanSlug));
        const slugDocs = await getDocs(slugQuery);
        
        const slugExistsForOtherUser = slugDocs.docs.some(d => d.id !== uid);
        if (slugExistsForOtherUser) {
          toast.error('Este link de vitrine já está em uso por outra pessoa. Escolha outro.');
          setSaving(false);
          return;
        }
      }

      // Salva dados na coleção 'perfis' (vitrine)
      await setDoc(doc(db, 'perfis', uid), {
        lojaUrl: cleanSlug,
        whatsapp: (whatsapp || '').replace(/\D/g, ''),
        logoUrl: logoUrl || '',
        brandName: brandName || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Salva dados extras na coleção 'users'
      const computedFirstName = extractFirstName(userName);
      await setDoc(doc(db, 'users', uid), {
        nome: userName || '',
        firstName: computedFirstName,
        pronoun: selectedPronoun || 'ela',
        dataNascimento: dataNascimento || '',
        telefone: (telefone || '').replace(/\D/g, ''),
        comoConheceu: comoConheceu || '',
        instagram: (instagram || '').replace('@', ''),
        proLabore: proLabore || '',
        horasMes: horasMes || '160',
        monthlyGoal: monthlyGoal || '',
        cnpjCpf: (cnpjCpf || '').replace(/\D/g, ''),
        endereco: endereco || '',
        cidade: cidade || '',
        estado: estado || '',
        cep: (cep || '').replace(/\D/g, ''),
        brandName: brandName || '',
        vitrineSlug: cleanSlug,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setVitrineSlug(cleanSlug);
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error("ERRO COMPLETO AO SALVAR PERFIL:", error);
      toast.error(error.message || 'Erro ao salvar o perfil.');
    }
    setSaving(false);
  };

  const handleBrandNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setBrandName(newName);
    if (!isSlugManuallyEdited) {
      setVitrineSlug(generateSlug(newName));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setVitrineSlug(cleaned);
    setIsSlugManuallyEdited(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await uploadImage(formData) as any;
      if (response.success && response.secure_url) {
        setLogoUrl(response.secure_url);
        toast.success('Logomarca carregada com sucesso!');
      } else {
        toast.error(response.error || 'Erro ao enviar a imagem.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro no upload.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const copyLink = async () => {
    if (!vitrineSlug) {
      toast.error("Defina a URL da vitrine primeiro!");
      return;
    }
    const url = `${window.location.origin}/vitrine/${vitrineSlug}`;
    await navigator.clipboard.writeText(url);
    setSlugCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setSlugCopied(false), 2000);
  };

  const handlePasswordReset = async () => {
    if (!userEmail) {
      toast.error('E-mail do usuário não encontrado.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, userEmail);
      toast.success('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao enviar e-mail de redefinição.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('@artesas/plan');
      localStorage.removeItem('@artesas/products_count');
      toast.success('Você saiu da sua conta.');
      router.push('/login');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao sair.');
    }
  };

  const handleUpgrade = async (interval: 'monthly' | 'yearly') => {
    if (!userId) {
      toast.error("Você precisa estar logada para assinar.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval, userId }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro retornado pelo servidor.");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Não foi possível gerar o link de checkout.");
      }
    } catch (error: any) {
      console.error("Erro detalhado no checkout:", error);
      toast.error(error.message || "Erro ao iniciar o checkout. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-foreground" size={48} />
      </div>
    );
  }

  const tabs = [
    { id: 'pessoal' as const, label: 'Pessoal', icon: User },
    { id: 'empresa' as const, label: 'Empresa', icon: Building2 },
    { id: 'vitrine' as const, label: 'Vitrine', icon: Store },
    { id: 'plano' as const, label: 'Assinatura', icon: Crown },
    { id: 'seguranca' as const, label: 'Segurança', icon: Shield },
  ];

  const planLabel = isPro ? 'PRO' : 'Gratuito';

  return (
    <div className="w-full min-h-screen bg-background py-8 px-4 md:px-8 pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Minha Conta</h1>
          <p className="text-slate-500 mt-1 font-bold">Gerencie seus dados, vitrine e assinatura.</p>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-secondary text-white shadow-lg shadow-secondary/20'
                    : 'bg-surface text-slate-600 border-2 border-border hover:border-slate-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ====== TAB: DADOS PESSOAIS & MARKETING ====== */}
        {activeTab === 'pessoal' && (
          <div className="bg-surface rounded-3xl shadow-sm border-2 border-border p-8 md:p-10 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-slate-100 rounded-2xl text-foreground">
                <User size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Dados Pessoais & Marketing</h2>
                <p className="text-slate-500 text-sm font-medium">Informações sobre você e como nos encontrou.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  value={userName || ''} onChange={e => setUserName(e.target.value)}
                  placeholder="Seu nome completo" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">E-mail</label>
                <input 
                  type="email" 
                  value={userEmail || ''}
                  disabled
                  className="w-full text-lg p-4 border-2 border-border bg-background text-slate-500 rounded-xl font-medium cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Calendar size={14} className="inline mr-1 -mt-0.5" />
                  Data de Nascimento
                </label>
                <input 
                  type="date" 
                  value={dataNascimento || ''} onChange={e => setDataNascimento(e.target.value)}
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Phone size={14} className="inline mr-1 -mt-0.5" />
                  Telefone / WhatsApp
                </label>
                <input 
                  type="text" 
                  value={telefone || ''} onChange={e => setTelefone(e.target.value)}
                  placeholder="Ex: (75) 99999-9999" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <User size={14} className="inline mr-1 -mt-0.5" />
                  Como prefere ser tratado(a)?
                </label>
                <select
                  value={selectedPronoun || ''} onChange={e => setSelectedPronoun(e.target.value as PronounType)}
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors bg-surface"
                >
                  <option value="ela">Ela / Dela</option>
                  <option value="ele">Ele / Dele</option>
                  <option value="neutro">Neutro / Prefiro não dizer</option>
                </select>
                <p className="text-xs text-slate-400 mt-1 font-medium">Usamos para personalizar os textos da plataforma para você.</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Dados de Marketing</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Como conheceu o AtelIA?</label>
                  <select
                    value={comoConheceu || ''} onChange={e => setComoConheceu(e.target.value)}
                    className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors bg-surface"
                  >
                    <option value="">Selecione...</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="google">Pesquisa no Google</option>
                    <option value="indicacao">Indicação de amiga(o)</option>
                    <option value="feira">Feira ou evento</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    <AtSign size={14} className="inline mr-1 -mt-0.5" />
                    Instagram do Ateliê
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">@</span>
                    <input 
                      type="text" 
                      value={instagram || ''} onChange={e => setInstagram(e.target.value.replace('@', ''))}
                      placeholder="seuatelie" 
                      className="w-full text-lg p-4 pl-10 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Configurações Financeiras Pessoais</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Valor do Pró-labore Desejado (R$)</label>
                  <input 
                    type="number" 
                    value={proLabore} onChange={e => setProLabore(e.target.value)}
                    placeholder="Ex: 3000" 
                    className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-medium">Este valor será usado como padrão na calculadora de precificação.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Horas Trabalhadas por Mês</label>
                  <input 
                    type="number" 
                    value={horasMes} onChange={e => setHorasMes(e.target.value)}
                    placeholder="Ex: 160" 
                    className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-medium">Usado para o cálculo do valor da sua hora.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Meta de Faturamento Mensal (R$)</label>
                  <input 
                    type="number" 
                    value={monthlyGoal} onChange={e => setMonthlyGoal(e.target.value)}
                    placeholder="Ex: 5000" 
                    className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-medium">Usado para acompanhar o seu progresso na Dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: CONFIGURAÇÕES DA EMPRESA ====== */}
        {activeTab === 'empresa' && (
          <div className="bg-surface rounded-3xl shadow-sm border-2 border-border p-8 md:p-10 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-indigo-100 rounded-2xl text-indigo-700">
                <Building2 size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Configurações da Empresa</h2>
                <p className="text-slate-500 text-sm font-medium">Dados fiscais e endereço do seu ateliê.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Ateliê / Marca</label>
                <input 
                  type="text" 
                  value={brandName || ''} onChange={handleBrandNameChange}
                  placeholder="Ex: Ateliê da Maria" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <CreditCard size={14} className="inline mr-1 -mt-0.5" />
                  CNPJ ou CPF
                </label>
                <input 
                  type="text" 
                  value={cnpjCpf || ''} onChange={e => setCnpjCpf(e.target.value)}
                  placeholder="000.000.000-00" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <MapPin size={14} className="inline mr-1 -mt-0.5" />
                  CEP
                </label>
                <input 
                  type="text" 
                  value={cep || ''} onChange={e => setCep(e.target.value)}
                  placeholder="00000-000" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Endereço</label>
                <input 
                  type="text" 
                  value={endereco || ''} onChange={e => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Cidade</label>
                <input 
                  type="text" 
                  value={cidade || ''} onChange={e => setCidade(e.target.value)}
                  placeholder="Ex: Salvador" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Estado</label>
                <select 
                  value={estado || ''} onChange={e => setEstado(e.target.value)}
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors bg-surface"
                >
                  <option value="">Selecione...</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logo */}
            <div className="mt-6 pt-6 border-t border-border">
              <label className="block text-sm font-bold text-slate-700 mb-3">Logomarca</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl border-2 border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                  {isUploadingLogo ? (
                    <Loader2 className="animate-spin text-foreground" size={32} />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-slate-400" size={32} />
                  )}
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl transition-colors inline-block border-2 border-border">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={isUploadingLogo}
                    />
                    {isUploadingLogo ? 'Enviando...' : (logoUrl ? 'Trocar Imagem' : 'Fazer Upload da Logo')}
                  </label>
                  <p className="text-xs text-slate-400 mt-2 font-medium">Recomendado: Imagem quadrada com fundo transparente (.png)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: CONFIGURAÇÕES DA VITRINE ====== */}
        {activeTab === 'vitrine' && (
          <div className="bg-surface rounded-3xl shadow-sm border-2 border-border p-8 md:p-10 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-emerald-100 rounded-2xl text-emerald-700">
                <Store size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Configuração da Vitrine</h2>
                <p className="text-slate-500 text-sm font-medium">Link público, WhatsApp e aparência da sua loja online.</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Slug / Link Público */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <LinkIcon size={14} className="inline mr-1 -mt-0.5" />
                  Link Público da Vitrine
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center border-2 border-border rounded-xl overflow-hidden focus-within:border-secondary bg-background transition-colors">
                    <span className="pl-4 text-slate-400 font-medium shrink-0">atelia.app.br/vitrine/</span>
                    <input 
                      type="text" 
                      value={vitrineSlug || ''} onChange={handleSlugChange}
                      placeholder="meu-atelie" 
                      className="w-full text-lg p-4 bg-transparent outline-none font-bold text-slate-800"
                    />
                  </div>
                  <button 
                    onClick={copyLink}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all shrink-0 ${
                      slugCopied 
                        ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-border'
                    }`}
                  >
                    {slugCopied ? <><Check size={20} /> Copiado!</> : <><Copy size={20} /> Copiar</>}
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-2 font-medium">Use apenas letras minúsculas, números e traços. Sem espaços ou caracteres especiais.</p>
                
                {vitrineSlug && (
                  <a 
                    href={`/vitrine/${vitrineSlug}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-foreground hover:underline"
                  >
                    <ExternalLink size={14} /> Ver minha vitrine ao vivo
                  </a>
                )}
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  <Phone size={14} className="inline mr-1 -mt-0.5" />
                  WhatsApp para Vendas
                </label>
                <input 
                  type="text" 
                  value={whatsapp || ''} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="Ex: 75988887777" 
                  className="w-full text-lg p-4 border-2 border-border rounded-xl font-medium focus:border-secondary focus:outline-none transition-colors"
                />
                <p className="text-sm text-slate-500 mt-2 font-medium">DDD + número, sem espaços. Ex: 75988887777</p>
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: ASSINATURA E UPGRADE ====== */}
        {activeTab === 'plano' && (
          <div className="animate-in fade-in duration-300 space-y-6">
            {/* Status Atual */}
            <div className="bg-surface rounded-3xl shadow-sm border-2 border-border p-8 md:p-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-2xl ${isPro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  <Crown size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Sua Assinatura</h2>
                  <p className="text-slate-500 text-sm font-medium">Gerencie seu plano e desbloqueie recursos avançados.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-slate-700">Status atual:</span>
                <span className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider ${
                  isPro ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {planLabel}
                </span>
              </div>
            </div>

            {/* Upgrade - só mostra se não for Pro */}
            {!isPro && (
              <div className="bg-gradient-to-br from-secondary to-secondary-hover rounded-3xl shadow-xl p-8 md:p-10 text-white relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-48 h-48 bg-surface/5 rounded-full blur-3xl"></div>
                <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-surface/5 rounded-full blur-2xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="text-primary" size={28} />
                    <h3 className="text-2xl font-black">Desbloqueie o AtelIA Pro</h3>
                  </div>
                  <p className="text-blue-200 font-medium mb-8 max-w-lg">Acesse relatórios avançados, IA Conselheira ilimitada, gestão de estoque completa e muito mais.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Plano Mensal - DESTAQUE */}
                    <div className="bg-surface/10 backdrop-blur-sm border-2 border-[#FFAA00] rounded-2xl p-6 text-center relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-foreground text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        Mais Acessível
                      </div>
                      <p className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-2 mt-2">Mensal</p>
                      <p className="text-4xl font-black text-white mb-1">R$ 29,90<span className="text-lg text-blue-200 font-medium">/mês</span></p>
                      <p className="text-sm text-blue-300 mb-5">Cancele quando quiser.</p>
                      <button 
                        onClick={() => handleUpgrade('monthly')}
                        disabled={checkoutLoading}
                        className="w-full bg-primary hover:bg-[#FFB833] text-foreground font-black py-4 px-6 rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 text-lg shadow-lg"
                      >
                        {checkoutLoading ? 'Redirecionando...' : 'Assinar Mensal'}
                      </button>
                    </div>

                    {/* Plano Anual */}
                    <div className="bg-surface/5 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6 text-center relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                        Economize R$ 59,80
                      </div>
                      <p className="text-blue-200 font-bold text-sm uppercase tracking-wider mb-2 mt-2">Anual</p>
                      <p className="text-4xl font-black text-white mb-1">R$ 299,00<span className="text-lg text-blue-200 font-medium">/ano</span></p>
                      <p className="text-sm text-emerald-300 mb-5">Equivale a R$ 24,91/mês</p>
                      <button 
                        onClick={() => handleUpgrade('yearly')}
                        disabled={checkoutLoading}
                        className="w-full bg-surface/10 hover:bg-surface/20 text-white font-black py-4 px-6 rounded-xl transition-all hover:-translate-y-0.5 border border-white/30 disabled:opacity-50 text-lg"
                      >
                        {checkoutLoading ? 'Redirecionando...' : 'Assinar Anual'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: SEGURANÇA E SESSÃO ====== */}
        {activeTab === 'seguranca' && (
          <div className="bg-surface rounded-3xl shadow-sm border-2 border-border p-8 md:p-10 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-red-100 rounded-2xl text-red-700">
                <Shield size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Segurança e Sessão</h2>
                <p className="text-slate-500 text-sm font-medium">Altere sua senha ou encerre sua sessão.</p>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handlePasswordReset}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-secondary hover:bg-background transition-all text-left group"
              >
                <div className="p-3 bg-slate-100 rounded-xl text-slate-600 group-hover:bg-secondary group-hover:text-white transition-colors">
                  <Key size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-lg">Alterar Senha</p>
                  <p className="text-sm text-slate-500 font-medium">Enviaremos um link de redefinição para {userEmail}</p>
                </div>
              </button>

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition-all text-left group"
              >
                <div className="p-3 bg-red-100 rounded-xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <LogOut size={22} />
                </div>
                <div>
                  <p className="font-bold text-red-700 text-lg">Sair da Conta</p>
                  <p className="text-sm text-red-400 font-medium">Encerrar sessão e voltar para a tela de login.</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Botão Salvar Global (aparece em abas com dados editáveis) */}
        {(activeTab === 'pessoal' || activeTab === 'empresa' || activeTab === 'vitrine') && (
          <div className="sticky bottom-6 z-40">
            <div className="bg-surface/80 backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-border p-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 font-bold hidden sm:block">Lembre-se de salvar antes de mudar de aba.</p>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-secondary hover:bg-secondary-hover text-white text-lg font-black px-8 py-4 rounded-xl transition-all shadow-lg flex items-center gap-3 disabled:opacity-50 w-full sm:w-auto justify-center"
              >
                {saving ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
