'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { PronounType } from '@/utils/greetings';

export type PlanType = 'free' | 'pro' | 'gratis' | 'intermediario' | 'profissional';

type TenantContextData = {
  currentPlan: PlanType;
  setPlan: (plan: PlanType) => void;
  isPro: boolean;
  canAccessDashboard: boolean;
  canAccessEstoque: boolean;
  canAccessPDV: boolean;
  canAccessConfig: boolean;
  canAccessAdvancedAnalytics: boolean;
  canCreateMoreProducts: () => boolean;
  incrementProductsCreated: () => void;
  productsCount: number;
  switchTenant: (tenantId: string) => void;
  userId: string | null;
  firstName: string;
  pronoun: PronounType;
  displayName: string;
};

const TenantContext = createContext<TenantContextData>({} as TenantContextData);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentPlan, setCurrentPlanState] = useState<PlanType>('free');
  const [productsCount, setProductsCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [pronoun, setPronoun] = useState<PronounType>('ela');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    // Processa retorno de login por redirecionamento (PWA/Mobile)
    getRedirectResult(auth).catch((error) => {
      console.error('Erro no retorno do redirecionamento do Google:', error);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Limpa escuta anterior se houver
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        setUserId(user.uid);
        // Fallback: usa displayName do Firebase Auth
        const authFirstName = user.displayName?.trim().split(/\s+/)[0] || '';
        setFirstName(authFirstName);
        setDisplayName(user.displayName || '');

        // Fonte da verdade: Firestore (coleção users)
        const userRef = doc(db, 'users', user.uid);
        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const firebasePlan = data.plan || 'free';
            
            setCurrentPlanState(firebasePlan as PlanType);
            localStorage.setItem('@artesas/plan', firebasePlan);

            // Dados de personalização
            if (data.firstName) {
              setFirstName(data.firstName);
            } else if (data.nome) {
              setFirstName(data.nome.trim().split(/\s+/)[0] || authFirstName);
            }
            if (data.pronoun) {
              setPronoun(data.pronoun as PronounType);
            }
            if (data.nome || data.displayName) {
              setDisplayName(data.nome || data.displayName || '');
            }
          } else {
            // Se o doc não existir, fallback
            setCurrentPlanState('free');
            localStorage.setItem('@artesas/plan', 'free');
          }
        }, (err) => {
          console.error('Erro na escuta em tempo real do perfil:', err);
        });
      } else {
        // Deslogado
        setUserId(null);
        setCurrentPlanState('free');
        setFirstName('');
        setPronoun('ela');
        setDisplayName('');
        localStorage.setItem('@artesas/plan', 'free');
      }
    });

    const storedCount = localStorage.getItem('@artesas/products_count');
    if (storedCount) {
      setProductsCount(parseInt(storedCount, 10));
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const setPlan = (plan: PlanType) => {
    setCurrentPlanState(plan);
    localStorage.setItem('@artesas/plan', plan);
  };

  const switchTenant = (tenantId: string) => {
    localStorage.setItem('@artesas/active_tenant', tenantId);
  };

  const incrementProductsCreated = () => {
    const newCount = productsCount + 1;
    setProductsCount(newCount);
    localStorage.setItem('@artesas/products_count', newCount.toString());
  };

  // Variável Global Mestra de Acesso Premium
  const isPro = currentPlan?.toLowerCase() === 'pro' || currentPlan?.toLowerCase() === 'profissional';

  const canCreateMoreProducts = () => {
    if (!isPro) {
      return productsCount < 5; // Limite do plano free
    }
    return true; // Ilimitado para PRO
  };

  // Regras de negócio reescritas baseadas no isPro
  const canAccessDashboard = true; 
  const canAccessEstoque = isPro || currentPlan === 'intermediario';
  const canAccessPDV = isPro;
  const canAccessConfig = isPro;
  const canAccessAdvancedAnalytics = isPro;

  return (
    <TenantContext.Provider value={{
      currentPlan,
      setPlan,
      switchTenant,
      isPro,
      canAccessDashboard,
      canAccessEstoque,
      canAccessPDV,
      canAccessConfig,
      canAccessAdvancedAnalytics,
      canCreateMoreProducts,
      incrementProductsCreated,
      productsCount,
      userId,
      firstName,
      pronoun,
      displayName
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
