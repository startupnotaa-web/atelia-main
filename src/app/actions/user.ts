'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { getUserLimits } from '@/lib/checkSubscriptionLimits';

export async function fetchUserLimitsAction(userId: string) {
  return getUserLimits(userId);
}

export async function updateMonthlyGoal(userId: string, goal: number) {
  if (!userId) throw new Error('Unauthorized');
  const db = getAdminDb();
  
  await db.collection('users').doc(userId).set({
    monthlyGoal: goal
  }, { merge: true });
}
