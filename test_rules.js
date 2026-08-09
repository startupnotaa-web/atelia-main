const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

// Initialize Admin SDK using the same logic as the app
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccount && admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount))
  });
}

// Config for Client SDK
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
const clientApp = initializeApp(firebaseConfig);
const clientAuth = getAuth(clientApp);
const clientDb = getFirestore(clientApp);

async function test() {
  const uid = '8dZBARUx7wZAgcYUh1BASsxn1iQ2';
  console.log('Generating custom token for', uid);
  const token = await admin.auth().createCustomToken(uid);
  
  console.log('Signing in with Client SDK...');
  await signInWithCustomToken(clientAuth, token);
  console.log('Signed in successfully as', clientAuth.currentUser.uid);

  try {
    console.log('Testing read from /users/' + uid);
    const userDoc = await getDoc(doc(clientDb, 'users', uid));
    console.log('Success! User doc exists:', userDoc.exists());
  } catch (e) {
    console.error('Failed reading user doc:', e.message);
  }

  try {
    console.log('Testing query on /pedidos');
    const q = query(collection(clientDb, 'pedidos'), where('userId', '==', uid));
    const snap = await getDocs(q);
    console.log('Success! Pedidos count:', snap.size);
  } catch (e) {
    console.error('Failed reading pedidos:', e.message);
  }
  
  process.exit(0);
}

test();
