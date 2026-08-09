'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { verifyAuth } from '@/lib/verifyAuth';

// ============================================================
// TYPES
// ============================================================

export type FinanceEntryType = 'entrada' | 'saida';

export interface FinanceEntry {
  id: string;
  date: string;
  type: FinanceEntryType;
  category: string;
  value: number;
  description: string;
  createdAt: string;
}

// ============================================================
// SERVER ACTIONS
// ============================================================

export async function fetchFinanceEntries(userId: string, limit: number = 50): Promise<FinanceEntry[]> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    const snapshot = await db.collection('finance_entries')
      .where('userId', '==', userId)
      .get();
      
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FinanceEntry[];

    return docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, limit);
  } catch (error) {
    console.error('Erro ao buscar lançamentos financeiros:', error);
    return [];
  }
}

export async function addFinanceEntry(data: Omit<FinanceEntry, 'id' | 'createdAt'>, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    if (data.value !== undefined && typeof data.value !== 'number') throw new Error('Valor inválido');
    if (data.description && typeof data.description === 'string' && data.description.length > 200) data.description = data.description.substring(0, 200);

    const db = getAdminDb();
    const newEntry = {
      ...data,
      userId,
      createdAt: new Date().toISOString()
    };
    
    await db.collection('finance_entries').add(newEntry);
    
    // Revalida a dashboard após a inclusão de um dado financeiro
    revalidatePath('/dashboard');
    revalidatePath('/evolucao');
    return { success: true };
  } catch (error) {
    console.error('Erro no servidor:', error);
    return { success: false, error: 'Falha ao registrar lançamento financeiro.' };
  }
}

export async function fetchInitialBalance(userId: string): Promise<number> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    
    const db = getAdminDb();
    const doc = await db.collection('settings').doc(userId).get();
    if (doc.exists) {
      return doc.data()?.initialBalance || 0;
    }
    return 0; // Default if not set
  } catch (error) {
    console.error('Erro ao buscar saldo inicial:', error);
    return 0;
  }
}

export async function updateInitialBalance(newBalance: number, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUserId = await verifyAuth();
    if (authUserId !== userId) throw new Error('Não autorizado');
    if (typeof newBalance !== 'number') throw new Error('Valor inválido');
    
    const db = getAdminDb();
    await db.collection('settings').doc(userId).set({
      initialBalance: newBalance,
      userId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar saldo inicial:', error);
    return { success: false, error: 'Falha ao atualizar saldo inicial' };
  }
}

export async function forceRevalidateDashboard() {
  revalidatePath('/dashboard');
}
