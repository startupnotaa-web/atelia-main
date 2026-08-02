'use server';

import { revalidatePath } from 'next/cache';

export async function revalidatePathCache(path: string, type?: 'page' | 'layout') {
  if (type) {
    revalidatePath(path, type);
  } else {
    revalidatePath(path);
  }
}
