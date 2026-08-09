import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function verifyAuth() {
  const sessionCookie = cookies().get('session')?.value;

  if (!sessionCookie) {
    throw new Error('401 Unauthorized');
  }

  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return decodedClaims.uid;
  } catch (error) {
    console.error('Falha ao verificar cookie de sessão:', error);
    throw new Error('401 Unauthorized');
  }
}
