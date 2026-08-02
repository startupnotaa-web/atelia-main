'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import { checkPdfLimit, incrementPdfCount } from '@/lib/checkSubscriptionLimits';

export interface QuoteClient {
  id: string;
  name: string;
  phone: string;
}

export interface QuoteProduct {
  id: string;
  nome: string;
  precoFinal: number;
}

export async function fetchClientsForQuotes(userId: string): Promise<QuoteClient[]> {
  try {
    if (!userId) throw new Error('Usuário não autenticado');
    const db = getAdminDb();
    const snapshot = await db.collection('clientes').where('userId', '==', userId).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.nome || 'Sem Nome',
        phone: data.phone || data.whatsapp || ''
      };
    });
  } catch (error) {
    console.error('Erro ao buscar clientes para orçamentos:', error);
    return [];
  }
}

export async function fetchProductsForQuotes(userId: string): Promise<QuoteProduct[]> {
  if (!userId) return [];
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('catalogo').where('userId', '==', userId).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nome: data.nome || data.name || 'Sem Nome',
        precoFinal: data.precoFinal || data.price || 0
      };
    });
  } catch (error) {
    console.error('Erro ao buscar produtos para orçamentos:', error);
    return [];
  }
}

export async function registerPdfGeneration(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) throw new Error('Usuário não autenticado');
    
    // Verifica limite de PDFs
    try {
      await checkPdfLimit(userId);
    } catch (e: any) {
      if (e.message.includes('PLAN_LIMIT_REACHED')) {
        return { success: false, error: 'LIMIT_REACHED_PDF' };
      }
      throw e;
    }

    // Incrementa contador de PDFs se for Free
    await incrementPdfCount(userId);

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao registrar geração de PDF:', error);
    return { success: false, error: error.message };
  }
}
