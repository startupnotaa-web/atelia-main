import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey,
};

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

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
