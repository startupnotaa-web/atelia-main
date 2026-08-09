'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navigation from './Navigation';
import FeedbackWidget from './FeedbackWidget';
import { useTenant } from '@/lib/TenantProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define o que é rota pública
  const isPublicRoute = ['/login', '/cadastro', '/boas-vindas', '/'].includes(pathname || '') || pathname?.startsWith('/vitrine');
  
  const { userId } = useTenant();

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative">
      <Navigation />
      <main className={`flex-1 w-full mx-auto ${isPublicRoute ? '' : 'max-w-6xl p-6 md:p-12'}`}>
        {!isPublicRoute ? (
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        ) : (
          children
        )}
      </main>
      {userId && !isPublicRoute && <FeedbackWidget />}
    </div>
  );
}
