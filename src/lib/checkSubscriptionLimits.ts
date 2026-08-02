import { getAdminDb } from './firebase-admin';

export type PlanType = 'free' | 'pro';

export interface UsageStats {
  savedProductsCount?: number;
  pricingsCount?: number;
  pdfsGeneratedThisMonth?: number;
}

export interface UserSubscriptionData {
  planType?: PlanType;
  usageStats?: UsageStats;
  lastPdfResetDate?: string;
}

export const FREE_LIMITS = {
  savedProducts: 5,
  pricings: 10,
  pdfsPerMonth: 1,
};

async function getUserData(userId: string): Promise<UserSubscriptionData> {
  const db = getAdminDb();
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return { planType: 'free' };
  return (doc.data() as UserSubscriptionData) || { planType: 'free' };
}

function isNewMonth(lastResetDate?: string) {
  if (!lastResetDate) return true;
  const lastDate = new Date(lastResetDate);
  const now = new Date();
  return lastDate.getMonth() !== now.getMonth() || lastDate.getFullYear() !== now.getFullYear();
}

export async function checkAIAccess(userId: string) {
  const data = await getUserData(userId);
  if (data.planType !== 'pro') {
    throw new Error('PLAN_LIMIT_REACHED: IA Exclusiva para Plano Pro');
  }
}

export async function checkVitrineAccess(userId: string) {
  const data = await getUserData(userId);
  if (data.planType !== 'pro') {
    throw new Error('PLAN_LIMIT_REACHED: Vitrine Pública Exclusiva para Plano Pro');
  }
}

export async function checkProductCreation(userId: string) {
  const data = await getUserData(userId);
  if (data.planType === 'pro') return;
  const count = data.usageStats?.savedProductsCount || 0;
  if (count >= FREE_LIMITS.savedProducts) {
    throw new Error('PLAN_LIMIT_REACHED: Limite de produtos atingido');
  }
}

export async function checkPricingLimit(userId: string) {
  const data = await getUserData(userId);
  if (data.planType === 'pro') return;
  const count = data.usageStats?.pricingsCount || 0;
  if (count >= FREE_LIMITS.pricings) {
    throw new Error('PLAN_LIMIT_REACHED: Limite de precificações atingido');
  }
}

export async function checkPdfLimit(userId: string) {
  const data = await getUserData(userId);
  if (data.planType === 'pro') return;
  
  const isReset = isNewMonth(data.lastPdfResetDate);
  const count = isReset ? 0 : (data.usageStats?.pdfsGeneratedThisMonth || 0);
  
  if (count >= FREE_LIMITS.pdfsPerMonth) {
    throw new Error('PLAN_LIMIT_REACHED: Limite de PDFs mensais atingido');
  }
}

// Opcional: Helpers de incremento
export async function incrementProductCount(userId: string) {
  const db = getAdminDb();
  const ref = db.collection('users').doc(userId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.data() as UserSubscriptionData;
    if (data?.planType === 'pro') return; // não gasta contador do PRO
    const current = data?.usageStats?.savedProductsCount || 0;
    t.set(ref, { usageStats: { savedProductsCount: current + 1 } }, { merge: true });
  });
}

export async function incrementPricingCount(userId: string) {
  const db = getAdminDb();
  const ref = db.collection('users').doc(userId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.data() as UserSubscriptionData;
    if (data?.planType === 'pro') return; // não gasta contador do PRO
    const current = data?.usageStats?.pricingsCount || 0;
    t.set(ref, { usageStats: { pricingsCount: current + 1 } }, { merge: true });
  });
}

export async function incrementPdfCount(userId: string) {
  const db = getAdminDb();
  const ref = db.collection('users').doc(userId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.data() as UserSubscriptionData;
    if (data?.planType === 'pro') return; // não gasta contador do PRO
    const isReset = isNewMonth(data?.lastPdfResetDate);
    const current = isReset ? 0 : (data?.usageStats?.pdfsGeneratedThisMonth || 0);
    t.set(ref, { 
      usageStats: { pdfsGeneratedThisMonth: current + 1 },
      lastPdfResetDate: new Date().toISOString()
    }, { merge: true });
  });
}

// Helper para o Frontend recuperar os limites via Server Action
export async function getUserLimits(userId: string) {
  const data = await getUserData(userId);
  const isPro = data.planType === 'pro';
  
  let pdfs = data.usageStats?.pdfsGeneratedThisMonth || 0;
  if (isNewMonth(data.lastPdfResetDate)) {
    pdfs = 0;
  }

  return {
    isPro,
    usage: {
      savedProducts: data.usageStats?.savedProductsCount || 0,
      pricings: data.usageStats?.pricingsCount || 0,
      pdfsGeneratedThisMonth: pdfs
    },
    limits: FREE_LIMITS
  };
}
