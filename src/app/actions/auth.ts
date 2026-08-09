'use server';

import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function createSessionCookie(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
  try {
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to create session cookie', error);
    return { success: false };
  }
}

export async function removeSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
