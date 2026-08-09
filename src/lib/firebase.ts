import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Evita inicializar multiplas vezes no Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configura o App Check apenas no lado do cliente (navegador)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  try {
    // Permite testes no localhost sem bloquear o App Check
    if (process.env.NODE_ENV === 'development') {
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
      // Ativa atualização automática do token
      isTokenAutoRefreshEnabled: true
    });
  } catch (e) {
    console.error("Erro ao inicializar o App Check", e);
  }
}

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Garante persistência local (essencial para PWA instalado)
setPersistence(auth, browserLocalPersistence).catch(console.error);

export { auth, db, googleProvider };
