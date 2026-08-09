const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  // Try to unescape it correctly depending on how Vercel exposes it
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1).replace(/\\n/g, '\n');
  }
}

let app;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    app = initializeApp({
      credential: cert(serviceAccountJson),
    });
  } else {
    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  }
} catch (e) {
  console.error("Failed to init firebase-admin", e);
  process.exit(1);
}

const db = getFirestore(app);

async function run() {
  const usersSnap = await db.collection('users').get();
  console.log(`Users found: ${usersSnap.size}`);
  usersSnap.forEach(doc => {
    console.log(`- ${doc.id}: ${doc.data().email}`);
  });

  const collections = ['pedidos', 'estoque', 'catalogo', 'finance_entries', 'clientes', 'estoque_pronto', 'equipamentos', 'partnerStores', 'partnerProducts'];
  
  for (const collName of collections) {
    const snap = await db.collection(collName).get();
    let orphanedCount = 0;
    let ownedCount = 0;
    snap.forEach(doc => {
      if (!doc.data().userId) {
        orphanedCount++;
      } else {
        ownedCount++;
      }
    });
    if (orphanedCount > 0 || ownedCount > 0) {
      console.log(`Collection [${collName}]: ${orphanedCount} orphaned, ${ownedCount} owned.`);
    }
  }
}

run().catch(console.error);
