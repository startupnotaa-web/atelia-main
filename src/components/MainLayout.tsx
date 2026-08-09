'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import FeedbackWidget from './FeedbackWidget';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = ['/login', '/cadastro', '/boas-vindas'].includes(pathname || '');

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative">
      <Navigation />
      <main className={`flex-1 w-full mx-auto ${isAuth ? '' : 'max-w-6xl p-6 md:p-12'}`}>
        {children}
      </main>
      {!isAuth && <FeedbackWidget />}
    </div>
  );
}
