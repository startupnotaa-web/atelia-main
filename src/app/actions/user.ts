'use server';

import { getAdminDb } from '@/lib/firebase-admin';

export async function updateMonthlyGoal(userId: string, goal: number) {
  if (!userId) throw new Error('Unauthorized');
  const db = getAdminDb();
  
  await db.collection('users').doc(userId).set({
    monthlyGoal: goal
  }, { merge: true });
}
