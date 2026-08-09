'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { getUserLimits } from '@/lib/checkSubscriptionLimits';
import { verifyAuth } from '@/lib/verifyAuth';

export async function fetchUserLimitsAction(userId: string) {
  return getUserLimits(userId);
}

export async function updateMonthlyGoal(userId: string, goal: number) {
  const authUserId = await verifyAuth();
  if (authUserId !== userId) throw new Error('Unauthorized');
  
  if (typeof goal !== 'number' || goal < 0 || !isFinite(goal)) throw new Error('Valor inválido');

  const db = getAdminDb();
  
  await db.collection('users').doc(userId).set({
    monthlyGoal: goal
  }, { merge: true });
}
