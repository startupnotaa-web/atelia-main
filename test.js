require('dotenv').config({path: '.env.local'});
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^["']|["']$/g, ''),
};
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = getFirestore();
async function test() {
  const snap = await db.collection('perfis').get();
  snap.forEach(doc => console.log('lojaUrl:', doc.data().lojaUrl, 'userId:', doc.id));
}
test();
