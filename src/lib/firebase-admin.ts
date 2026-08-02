import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

function initAdmin() {
  if (!getApps().length) {
    try {
      // Caso FIREBASE_SERVICE_ACCOUNT_KEY seja usado como JSON completo (fallback):
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          initializeApp({
            credential: cert(serviceAccountJson),
          });
        } catch (parseError) {
          console.error("Erro fatal ao fazer o parse do FIREBASE_SERVICE_ACCOUNT_KEY JSON. Verifique as aspas e quebras de linha na Vercel:", parseError);
          throw parseError;
        }
      } else {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        };

        initializeApp({
          credential: cert(serviceAccount),
        });
      }
    } catch (error) {
      console.error('Firebase admin initialization error', error);
      throw error;
    }
  }
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initAdmin();
  return getAuth();
}
