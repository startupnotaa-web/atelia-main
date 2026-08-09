require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function checkUsers() {
  const snapshot = await db.collection('users').get();
  console.log(`Found ${snapshot.size} users`);
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

checkUsers();
