'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Package, Store } from 'lucide-react';
import { getPublicProducts } from '@/app/actions/vitrine';
import type { VitrineProfile, VitrineProduct } from '@/app/actions/vitrine';

export default function VitrinePage({ params }: { params: Promise<{ loja: string }> }) {
  const [lojaParam, setLojaParam] = useState<string | null>(null);
  const [profile, setProfile] = useState<VitrineProfile | null>(null);
  const [products, setProducts] = useState<VitrineProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(p => setLojaParam(p.loja.toLowerCase())).catch(err => {
      console.error(err);
      setError('Loja inválida.');
      setLoading(false);
    });
  }, [params]);

  useEffect(() => {
    if (!lojaParam) return;

    const fetchData = async () => {
      try {
        const res = await getPublicProducts(lojaParam);
        
        if (!res.success || !res.profile) {
          setError(res.error || 'Vitrine não encontrada. Verifique se o link está correto.');
          setLoading(false);
          return;
        }

        setProfile(res.profile);
        setProducts(res.products || []);
      } catch (err) {
        console.error(err);
        setError('Ocorreu um erro ao carregar a vitrine.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lojaParam]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleWhatsAppClick = (product: VitrineProduct) => {
    if (!profile?.whatsapp) {
      alert('Esta artesã ainda não configurou o WhatsApp.');
      return;
    }
    const msg = `Olá! Gostaria de encomendar a peça ${product.nome} no valor de ${formatCurrency(product.precoFinal)}.`;
    const encodedMsg = encodeURIComponent(msg);
    const waUrl = `https://wa.me/55${profile.whatsapp}?text=${encodedMsg}`; // Garantindo que tem o 55 de DDI se for Brasil, assumindo 55 default
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-slate-500 font-medium">Carregando catálogo...</div>;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center">
        <Store size={64} className="text-slate-300 mb-6" />
        <h1 className="text-3xl font-black text-slate-800 mb-2">Ops!</h1>
        <p className="text-slate-500 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans pb-20">
      {/* Cabeçalho da Vitrine */}
      <header className="bg-surface border-b border-[#EAE5D9] py-12 px-4 shadow-sm text-center flex flex-col items-center">
        {profile.logoUrl ? (
          <img src={profile.logoUrl} alt={profile.brandName} className="w-32 h-32 object-cover rounded-full shadow-md mb-6 border-4 border-white" />
        ) : (
          <div className="w-32 h-32 bg-[#EAE5D9] rounded-full flex items-center justify-center mb-6 shadow-md border-4 border-white">
            <Store size={48} className="text-[#C1B7A0]" />
          </div>
        )}
        <h1 className="text-4xl font-black text-[#4A3B32] mb-2">{profile.brandName || 'Meu Ateliê'}</h1>
        <p className="text-[#8C7A6B] text-lg font-medium">Boas-vindas ao meu catálogo de criações exclusivas.</p>
      </header>

      {/* Lista de Produtos */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 mt-12">
        {products.length === 0 ? (
          <div className="text-center py-20 text-[#8C7A6B]">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl">Sua vitrine está pronta, mas ainda não possui produtos ativos. Cadastre seus itens na aba Meus Produtos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map(product => (
              <div key={product.id} className="bg-surface rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-[#EAE5D9] flex flex-col group">
                <div className="aspect-square bg-[#F4F1EB] relative overflow-hidden flex items-center justify-center">
                  {product.fotoUrl ? (
                    <img src={product.fotoUrl} alt={product.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <Package size={64} className="text-[#D3CABC]" />
                  )}
                </div>
                
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#4A3B32] mb-4 leading-tight">{product.nome}</h2>
                    <span className="text-3xl font-black block mb-6" style={{ color: '#4A5D23' }}>
                      {formatCurrency(product.precoFinal)}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleWhatsAppClick(product)}
                    className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle size={22} fill="currentColor" className="text-white" />
                    Tenho Interesse
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Simples */}
      <footer className="mt-20 text-center text-[#A69B8D] text-sm">
        <p>Catálogo digital criado com <strong>AtelIA</strong></p>
      </footer>
    </div>
  );
}
