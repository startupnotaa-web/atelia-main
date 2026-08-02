import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    if (decodedToken.email !== 'davidossantosrochadesouza@gmail.com') {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    const db = getAdminDb();
    
    // Lista os usuários do Auth (suporta até 1000 por vez)
    const listUsersResult = await auth.listUsers(1000);
    let syncedCount = 0;

    for (const userRecord of listUsersResult.users) {
      const userRef = db.collection('users').doc(userRecord.uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        await userRef.set({
          email: userRecord.email || '',
          plan: 'free',
          createdAt: new Date().toISOString()
        });
        syncedCount++;
      }
    }
    
    return NextResponse.json({ success: true, syncedCount });
  } catch (error: any) {
    console.error('Erro ao sincronizar usuários:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao sincronizar usuários' }, { status: 500 });
  }
}
