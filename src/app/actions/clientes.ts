'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

// ============================================================
// TYPES
// ============================================================

export interface Client {
  id: string;
  name: string;
  phone: string;
  birthday: string;
  createdAt: string;
  userId?: string;
}

export interface PointOfSale {
  id: string;
  name: string;
  commissionPercent: number;
  createdAt: string;
  userId?: string;
}

// ============================================================
// SERVER ACTIONS
// ============================================================

export async function fetchClients(userId: string): Promise<Client[]> {
  try {
    if (!userId) throw new Error('Usuário não autenticado');
    const db = getAdminDb();
    const snapshot = await db.collection('clientes').where('userId', '==', userId).get();
    
    let clientes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
    
    // Sort localmente por data de criação ou nome
    clientes.sort((a, b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    return clientes;
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return [];
  }
}

export async function addClient(data: Omit<Client, 'id' | 'createdAt'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getAdminDb();
    
    if (data.userId) {
      const perfilDoc = await db.collection('perfis').doc(data.userId).get();
      if (perfilDoc.exists) {
        const plano = perfilDoc.data()?.plano || 'gratis';
        if (plano === 'gratis') {
          const clientesSnap = await db.collection('clientes').where('userId', '==', data.userId).get();
          if (clientesSnap.size >= 20) {
            return { success: false, error: 'LIMIT_REACHED_CLIENTS' };
          }
        }
      }
    }

    if (!data.userId) throw new Error('Usuário não autenticado');

    const newEntry = {
      ...data,
      userId: data.userId,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('clientes').add(newEntry);
    revalidatePath('/clientes');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao adicionar cliente:', error);
    return { success: false, error: 'Falha ao registrar cliente' };
  }
}

export async function deleteClient(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    await db.collection('clientes').doc(clientId).delete();
    
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    return { success: false, error: 'Erro ao excluir o cliente.' };
  }
}

// --- PONTOS DE VENDA ---

export async function fetchPointsOfSale(userId: string): Promise<PointOfSale[]> {
  try {
    if (!userId) throw new Error('Usuário não autenticado');
    const db = getAdminDb();
    const snapshot = await db.collection('lojas').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PointOfSale[];
  } catch (error) {
    console.error('Erro ao buscar lojas:', error);
    return [];
  }
}

export async function addPointOfSale(data: Omit<PointOfSale, 'id' | 'createdAt'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = getAdminDb();

    if (data.userId) {
      const perfilDoc = await db.collection('perfis').doc(data.userId).get();
      if (perfilDoc.exists) {
        const plano = perfilDoc.data()?.plano || 'gratis';
        if (plano === 'gratis') {
          const lojasSnap = await db.collection('lojas').where('userId', '==', data.userId).get();
          if (lojasSnap.size >= 1) {
            return { success: false, error: 'LIMIT_REACHED_STORES' };
          }
        }
      }
    }

    if (!data.userId) throw new Error('Usuário não autenticado');

    const newEntry = {
      ...data,
      userId: data.userId,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('lojas').add(newEntry);
    revalidatePath('/clientes');
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Erro ao adicionar loja:', error);
    return { success: false, error: 'Falha ao registrar loja' };
  }
}

export async function deletePointOfSale(posId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getAdminDb();
    await db.collection('lojas').doc(posId).delete();
    
    revalidatePath('/clientes');
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir loja:', error);
    return { success: false, error: 'Erro ao excluir a loja.' };
  }
}
