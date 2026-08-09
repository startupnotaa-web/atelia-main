'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navigation from './Navigation';
import FeedbackWidget from './FeedbackWidget';
import { useTenant } from '@/lib/TenantProvider';
import { Loader2 } from 'lucide-react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Define o que é rota pública
  const isPublicRoute = ['/login', '/cadastro', '/boas-vindas', '/'].includes(pathname || '') || pathname?.startsWith('/vitrine');
  
  const { userId, isLoading } = useTenant();

  // Redirecionamento unificado (Proteção de Rotas Client-Side)
  useEffect(() => {
    if (!isLoading && !userId && !isPublicRoute) {
      router.push('/login');
    }
  }, [isLoading, userId, isPublicRoute, router]);

  // Se estiver carregando e for rota privada, exibe spinner em vez de piscar tela
  if (isLoading && !isPublicRoute) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-slate-500 font-bold text-sm">Validando acesso...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado e não for rota pública, previne renderização do conteúdo da rota privada
  if (!isLoading && !userId && !isPublicRoute) {
    return null; 
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative">
      <Navigation />
      <main className={`flex-1 w-full mx-auto ${isPublicRoute ? '' : 'max-w-6xl p-6 md:p-12'}`}>
        {children}
      </main>
      {userId && !isPublicRoute && <FeedbackWidget />}
    </div>
  );
}
