'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calculator, Package, Users, Settings, Menu, X, FileText, ShoppingBag, Store, Crown, ClipboardList, Sparkles, TrendingUp, PackageCheck, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUserEmail(user?.email || null);
      if (user) {
        try {
          const { db } = await import('@/lib/firebase');
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              email: user.email,
              plan: 'free',
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString()
            });
          } else {
            await setDoc(userRef, {
              lastLogin: new Date().toISOString()
            }, { merge: true });
          }
        } catch (e) {
          console.error('Erro sincronizando usuário', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Ocultar menu em rotas específicas
  if (!pathname || ['/login', '/cadastro', '/boas-vindas', '/'].includes(pathname) || pathname.startsWith('/vitrine')) {
    return null;
  }

  interface MenuItem {
    name: string;
    href: string;
    icon: any;
    isAdmin?: boolean;
  }

  const baseMenuItems: MenuItem[] = [
    { name: 'Início / Painel', href: '/dashboard', icon: Home },
    { name: 'Inteligência Artificial', href: '/ia', icon: Sparkles },
    { name: 'Evolução da Empresa', href: '/evolucao', icon: TrendingUp },
    { name: 'Pedidos', href: '/pedidos', icon: ClipboardList },
    { name: 'Venda de Balcão', href: '/venda-balcao', icon: ShoppingCart },
    { name: 'Pronta-Entrega', href: '/pronta-entrega', icon: PackageCheck },
    { name: 'Orçamentos', href: '/orcamentos', icon: FileText },
    { name: 'Meus Produtos', href: '/meus-produtos', icon: ShoppingBag },
    { name: 'Calculadora', href: '/calculadora', icon: Calculator },
    { name: 'Estoque', href: '/estoque', icon: Package },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Lojas Parceiras', href: '/consignacoes', icon: Store },
    { name: 'Perfil & Config.', href: '/perfil', icon: Settings },
  ];

  const menuItems: MenuItem[] = userEmail === 'davidossantosrochadesouza@gmail.com'
    ? [...baseMenuItems, { name: 'Painel Admin', href: '/admin', icon: Crown, isAdmin: true }]
    : baseMenuItems;

  return (
    <>
      {/* Sidebar para Desktop (Telas Maiores) */}
      <aside className="hidden md:flex flex-col w-[280px] bg-surface border-r border-border h-screen sticky top-0 shadow-sm z-50">
        <div className="p-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Logo AtelIA" className="w-7 h-7 object-contain rounded-md" />
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Atel<span className="text-primary">IA</span></h1>
          </div>
          <p className="text-secondary mt-2 text-xs font-heading font-bold uppercase tracking-widest">Meu Ateliê</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-heading text-sm font-semibold ${
                  isActive 
                    ? 'bg-background text-foreground shadow-sm border border-border' 
                    : 'text-secondary hover:bg-background/50 hover:text-foreground'
                } ${item.isAdmin ? 'mt-4 border-alert/30 text-alert hover:border-alert bg-alert/5' : ''}`}
              >
                <Icon size={20} className={isActive ? 'text-primary' : (item.isAdmin ? 'text-alert' : 'text-secondary')} />
                <span>
                  {item.isAdmin && !isActive ? '👑 ' : ''}{item.name}
                </span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Header e Menu para Celular (Mobile) */}
      <header className="md:hidden sticky top-0 left-0 right-0 h-16 bg-surface border-b border-border z-50 shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Logo AtelIA" className="w-6 h-6 object-contain rounded-md" />
          <h1 className="text-xl font-heading font-bold text-foreground tracking-tight">Atel<span className="text-primary">IA</span></h1>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-secondary p-2 hover:bg-background rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Menu Hamburger Aberto (Mobile) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-surface z-40 flex flex-col px-4 py-6 overflow-y-auto">
          <nav className="flex flex-col space-y-2 pb-24">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
              const Icon = item.icon;
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-xl transition-all font-heading font-semibold text-base ${
                    isActive 
                      ? 'bg-background text-foreground shadow-sm border border-border' 
                      : 'text-secondary hover:bg-background/50'
                  } ${item.isAdmin ? 'mt-4 border-alert/30 text-alert bg-alert/5' : ''}`}
                >
                  <Icon size={24} className={isActive ? 'text-primary' : (item.isAdmin ? 'text-alert' : 'text-secondary')} />
                  <span>
                    {item.isAdmin && !isActive ? '👑 ' : ''}{item.name}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </>
  );
}
