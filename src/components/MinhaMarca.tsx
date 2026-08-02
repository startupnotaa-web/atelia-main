'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/TenantProvider';
import { Upload, Lock, FileText, CheckCircle2, AtSign, Phone, MapPin, CreditCard, Loader2 } from 'lucide-react';
import Paywall from '@/components/Paywall';
import { db, auth } from '@/lib/firebase';
import { doc as firestoreDoc, getDoc, setDoc as firestoreSetDoc } from 'firebase/firestore';
import { uploadImage } from '@/app/actions/upload-image';

const COLORS = [
  { name: 'Amarelo Dendê', hex: '#FFAA00' },
  { name: 'Azul Anil', hex: '#1A365D' },
  { name: 'Terracota', hex: '#B24020' },
  { name: 'Verde Musgo', hex: '#4A7C59' },
  { name: 'Roxo Açaí', hex: '#5B21B6' },
  { name: 'Rosa Pitaya', hex: '#DB2777' },
  { name: 'Laranja Caju', hex: '#EA580C' },
  { name: 'Ciano Bahia', hex: '#0891B2' },
];

export default function MinhaMarca() {
  const { canAccessConfig } = useTenant();

  // Dados do Ateliê
  const [brandName, setBrandName] = useState('O Meu Ateliê');
  const [doc, setDoc] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [address, setAddress] = useState('');

  // Identidade Visual
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);
  const [logoUploaded, setLogoUploaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrlState, setLogoUrlState] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const docRef = firestoreDoc(db, 'perfis', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setBrandName(data.brandName || 'O Meu Ateliê');
              setDoc(data.doc || '');
              setWhatsapp(data.whatsapp || '');
              setInstagram(data.instagram || '');
              setAddress(data.address || '');
              setSelectedColor(data.selectedColor || COLORS[0].hex);
              setLogoUrlState(data.logoUrl || '');
              setLogoUploaded(!!data.logoUrl);
            }
          } catch (e) {
            console.error(e);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) {
      alert("Faça login para salvar a marca.");
      return;
    }
    setSaving(true);
    const lojaUrl = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const data = { 
      brandName, 
      doc, 
      whatsapp, 
      instagram, 
      address, 
      selectedColor,
      lojaUrl,
      logoUrl: logoUrlState
    };
    
    try {
      await firestoreSetDoc(firestoreDoc(db, 'perfis', auth.currentUser.uid), data, { merge: true });
      alert(`Configurações salvas! O link da sua vitrine é: /vitrine/${lojaUrl}`);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar as configurações.');
    }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await uploadImage(formData) as any;
      if (response.success && response.secure_url) {
        setLogoUrlState(response.secure_url);
        setLogoUploaded(true);
      } else {
        alert(response.error || 'Erro ao enviar a imagem.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-10">
      
      {/* Lado Esquerdo: Formulários */}
      <div className="xl:col-span-7 space-y-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-secondary">A Minha Marca</h1>
          <p className="text-xl text-slate-600 mt-2">Configure a identidade do seu negócio para gerar orçamentos profissionais.</p>
        </div>

        {/* 1. Dados do Ateliê */}
        <section className="bg-surface rounded-[2rem] p-8 md:p-10 border-4 border-border shadow-sm">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Dados do Negócio</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xl font-semibold text-slate-900 mb-3">Nome da Marca</label>
              <input 
                type="text" 
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="Ex: Ateliê da Maria" 
                className="w-full text-2xl p-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">CPF ou CNPJ</label>
                <div className="relative">
                  <CreditCard className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
                  <input 
                    type="text" 
                    value={doc} onChange={e => setDoc(e.target.value)}
                    placeholder="Opcional" 
                    className="w-full text-xl pl-16 pr-6 py-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
                  <input 
                    type="text" 
                    value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                    placeholder="(00) 00000-0000" 
                    className="w-full text-xl pl-16 pr-6 py-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">Instagram (@)</label>
                <div className="relative">
                  <AtSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
                  <input 
                    type="text" 
                    value={instagram} onChange={e => setInstagram(e.target.value)}
                    placeholder="@seu.atelie" 
                    className="w-full text-xl pl-16 pr-6 py-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-3">Endereço</label>
                <div className="relative">
                  <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
                  <input 
                    type="text" 
                    value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Cidade/Estado" 
                    className="w-full text-xl pl-16 pr-6 py-6 border-2 border-slate-300 rounded-2xl text-slate-900 font-medium focus:border-secondary focus:ring-4 focus:ring-secondary-light"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Identidade Visual (Paywall aplicado aqui se não for Pro) */}
        <section className="relative bg-surface rounded-[2rem] border-4 border-border shadow-sm overflow-hidden">
          
          {/* O conteúdo real da seção */}
          <div className={`p-8 md:p-10 ${!canAccessConfig ? 'blur-sm select-none opacity-50' : ''}`}>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Identidade Visual (Cores e Logo)</h2>
            
            <div className="space-y-10">
              {/* Logo Upload */}
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-4">A sua Logomarca</label>
                <div className="relative w-full md:w-auto min-h-[160px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={canAccessConfig ? handleImageUpload : undefined}
                    disabled={isUploading || !canAccessConfig}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    title={canAccessConfig ? 'Clique para enviar' : 'Bloqueado no seu plano'}
                  />
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 border-4 border-dashed border-slate-300 hover:border-primary hover:bg-background transition-all rounded-3xl gap-4 text-slate-600 hover:text-slate-900">
                    {isUploading ? (
                      <>
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <span className="text-2xl font-bold">Enviando imagem...</span>
                      </>
                    ) : logoUploaded ? (
                      <>
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-success mb-2 shadow-sm">
                          <img src={logoUrlState} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-2xl font-bold text-success">Logo Enviada!</span>
                        <span className="text-lg">Clique para trocar a imagem</span>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                          <Upload size={32} />
                        </div>
                        <span className="text-2xl font-bold">Clique para enviar a sua Logo (Upload)</span>
                        <span className="text-lg">Fundo transparente (.png) recomendado</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Seletor de Cores */}
              <div>
                <label className="block text-xl font-semibold text-slate-900 mb-4">Cor Principal dos Orçamentos</label>
                <div className="flex flex-wrap gap-4">
                  {COLORS.map(color => (
                    <button
                      key={color.hex}
                      onClick={() => canAccessConfig && setSelectedColor(color.hex)}
                      title={color.name}
                      className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all shadow-sm ${
                        selectedColor === color.hex 
                          ? 'scale-110 ring-4 ring-offset-4 ring-slate-900' 
                          : 'hover:scale-105 hover:shadow-md'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {selectedColor === color.hex && <CheckCircle2 size={32} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Paywall Overlay */}
          {!canAccessConfig && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/60 backdrop-blur-sm p-6 text-center overflow-auto">
               <div className="transform scale-90 w-full max-w-4xl mx-auto origin-center mt-auto mb-auto">
                 <Paywall title="Estúdio de Marca Premium" description="Faça o upgrade para o Plano Profissional e envie sua própria logo, mudando também as cores dos seus orçamentos em PDF!" />
               </div>
            </div>
          )}

        </section>

        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full bg-secondary hover:bg-secondary-hover text-white text-3xl font-black py-8 rounded-[2rem] transition-colors shadow-lg flex items-center justify-center gap-4 disabled:opacity-70"
        >
          {saving ? <Loader2 size={32} className="animate-spin" /> : 'Salvar Minha Marca'}
        </button>
      </div>

      {/* Lado Direito: Preview de Orçamento em Tempo Real */}
      <div className="xl:col-span-5 h-full">
        <div className="sticky top-10 w-full bg-surface rounded-[2rem] border-4 border-border shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          {/* Header do Preview dinâmico */}
          <div className="px-8 py-10 text-white transition-colors duration-500 flex flex-col items-center justify-center relative" style={{ backgroundColor: selectedColor }}>
            <div className="absolute top-6 left-6 flex gap-2 opacity-50">
               <div className="w-4 h-4 rounded-full bg-surface" />
               <div className="w-4 h-4 rounded-full bg-surface" />
               <div className="w-4 h-4 rounded-full bg-surface" />
            </div>
            
            {logoUploaded && logoUrlState ? (
               <div className="w-24 h-24 rounded-full bg-surface/20 backdrop-blur-md mb-4 flex items-center justify-center border-2 border-white/50 overflow-hidden shadow-sm">
                 <img src={logoUrlState} alt="Logo" className="w-full h-full object-cover" />
               </div>
            ) : (
               <div className="w-24 h-24 rounded-full bg-surface/20 backdrop-blur-md mb-4 flex items-center justify-center border-2 border-white/50">
                 <Upload size={32} className="text-white" />
               </div>
            )}
            
            <h3 className="text-3xl font-black text-center drop-shadow-md">{brandName || 'O Meu Ateliê'}</h3>
            <p className="text-white/80 font-medium mt-1">Orçamento Oficial</p>
          </div>

          {/* Corpo do Preview (Simulando o PDF) */}
          <div className="p-8 flex-1 bg-background flex flex-col gap-6">
            <div className="w-3/4 h-8 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-full h-4 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-5/6 h-4 bg-slate-200 rounded-lg animate-pulse" />
            <div className="w-full h-4 bg-slate-200 rounded-lg animate-pulse" />
            
            <div className="mt-6 bg-surface p-6 rounded-2xl border-2 border-border shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b-2 border-border pb-4">
                 <span className="font-bold text-slate-600">Peça Exclusiva</span>
                 <span className="font-black text-slate-900">R$ 150,00</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="font-bold text-slate-900 text-xl">TOTAL</span>
                 <span className="font-black text-2xl" style={{ color: selectedColor }}>R$ 150,00</span>
              </div>
            </div>

            <button className="mt-auto w-full py-5 rounded-2xl text-white font-bold text-xl transition-colors shadow-md" style={{ backgroundColor: selectedColor }}>
              Aprovar Orçamento
            </button>
          </div>
        </div>
        <p className="text-center text-slate-500 font-semibold mt-4">
          Visualização (Preview) do Documento PDF
        </p>
      </div>

    </div>
  );
}
