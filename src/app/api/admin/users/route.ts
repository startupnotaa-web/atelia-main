import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
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
    
    // Fetch all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    const perfisSnapshot = await db.collection('perfis').get();
    
    const userMap = new Map();
    
    perfisSnapshot.forEach(doc => {
      userMap.set(doc.id, { 
        id: doc.id, 
        email: doc.data().email, 
        createdAt: doc.data().createdAt,
        plan: doc.data().plano === 'pro' ? 'pro' : 'free',
        ...doc.data() 
      });
    });

    usersSnapshot.forEach(doc => {
      if (userMap.has(doc.id)) {
        userMap.set(doc.id, { ...userMap.get(doc.id), ...doc.data() });
      } else {
        userMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    const users = Array.from(userMap.values());
    
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Erro ao buscar usuários (Admin API):', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao buscar usuários' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { userId, plan } = body;

    if (!userId || !plan) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    const db = getAdminDb();
    
    const userRef = db.collection('users').doc(userId);
    await userRef.set({ plan, planType: plan }, { merge: true });
    
    const perfilRef = db.collection('perfis').doc(userId);
    await perfilRef.set({ plano: plan === 'pro' ? 'pro' : 'gratis' }, { merge: true });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao atualizar plano (Admin API):', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao atualizar plano' }, { status: 500 });
  }
}
