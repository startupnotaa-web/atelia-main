import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const collections = ['pedidos', 'estoque', 'catalogo', 'finance_entries', 'clientes', 'estoque_pronto', 'equipamentos', 'partnerStores', 'partnerProducts'];
    
    const userCounts: Record<string, number> = {};

    for (const collName of collections) {
      const snap = await db.collection(collName).get();
      snap.forEach(doc => {
        const uid = doc.data().userId || 'NO_USER';
        userCounts[uid] = (userCounts[uid] || 0) + 1;
      });
    }

    return NextResponse.json({ userCounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
