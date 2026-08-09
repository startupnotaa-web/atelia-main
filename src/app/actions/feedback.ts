'use server';

import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/verifyAuth';

export async function submitFeedback(type: string, message: string) {
  try {
    const userId = await verifyAuth();
    
    // Fetch user email
    const userRecord = await getAdminAuth().getUser(userId);
    const email = userRecord.email || 'Não informado';

    // Validate inputs
    if (!type || !message) {
      throw new Error('Tipo e mensagem são obrigatórios.');
    }

    if (message.length > 2000) {
      throw new Error('A mensagem excedeu o limite de caracteres.');
    }

    const db = getAdminDb();
    
    await db.collection('userFeedbacks').add({
      userId,
      email,
      type,
      message,
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao enviar feedback:', error);
    return { success: false, error: error.message || 'Erro ao enviar feedback' };
  }
}
