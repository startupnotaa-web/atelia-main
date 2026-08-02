'use server';

import { getAdminDb } from '@/lib/firebase-admin';

export type VitrineProfile = {
  id: string;
  brandName: string;
  logoUrl: string;
  lojaUrl: string;
  whatsapp: string;
};

export type VitrineProduct = {
  id: string;
  nome: string;
  precoFinal: number;
  fotoUrl?: string;
  visivelNaVitrine?: boolean;
};

export async function getPublicProducts(lojaUrl: string) {
  try {
    const db = getAdminDb();
    
    // 1. Buscar Perfil
    const perfilSnap = await db.collection('perfis').where('lojaUrl', '==', lojaUrl).limit(1).get();
    
    if (perfilSnap.empty) {
      return { success: false, error: 'Vitrine não encontrada.' };
    }

    const perfilDoc = perfilSnap.docs[0];
    const perfilData = { id: perfilDoc.id, ...perfilDoc.data() } as VitrineProfile;

    // 2. Buscar Produtos
    const produtosSnap = await db.collection('catalogo').where('userId', '==', perfilDoc.id).get();
    
    const products: VitrineProduct[] = [];
    produtosSnap.forEach((doc) => {
      const prod = { id: doc.id, ...doc.data() } as VitrineProduct;
      if (prod.visivelNaVitrine !== false) {
        products.push(prod);
      }
    });

    return { success: true, profile: perfilData, products };
  } catch (error) {
    console.error('Erro ao buscar dados da vitrine:', error);
    return { success: false, error: 'Ocorreu um erro interno ao carregar a vitrine.' };
  }
}
