import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const execute = searchParams.get('execute') === 'true';
    const targetUserId = searchParams.get('userId');
    const targetEmail = searchParams.get('email'); // e.g. davidossantosrochadesouza@gmail.com

    const auth = getAdminAuth();
    let uid = targetUserId;

    if (!uid && targetEmail) {
      const userRecord = await auth.getUserByEmail(targetEmail);
      uid = userRecord.uid;
    }

    if (!uid) {
      return NextResponse.json({ error: 'Please provide ?userId=... or ?email=...' }, { status: 400 });
    }

    const db = getAdminDb();
    const collections = ['pedidos', 'estoque', 'catalogo', 'finance_entries', 'clientes', 'estoque_pronto', 'equipamentos', 'partnerStores', 'partnerProducts'];
    
    const results: Record<string, { orphaned: number, migrated: number }> = {};
    let totalMigrated = 0;

    for (const collName of collections) {
      const snap = await db.collection(collName).get();
      let orphanedCount = 0;
      let migratedCount = 0;
      
      const batch = db.batch();
      let batchCount = 0;

      snap.forEach(doc => {
        const data = doc.data();
        if (!data.userId) {
          orphanedCount++;
          if (execute) {
            batch.update(doc.ref, { userId: uid });
            batchCount++;
            migratedCount++;
          }
        }
      });

      if (execute && batchCount > 0) {
        // NOTE: A Firestore batch can hold up to 500 operations. 
        // For a simple script, we assume less than 500 orphaned docs per collection.
        // If there are more, we would need to chunk them, but for this app it should be fine.
        if (batchCount <= 500) {
          await batch.commit();
        } else {
          // Fallback to individual updates if > 500
          const orphanedDocs = snap.docs.filter(d => !d.data().userId);
          for (const d of orphanedDocs) {
            await d.ref.update({ userId: uid });
          }
        }
      }

      results[collName] = { orphaned: orphanedCount, migrated: migratedCount };
      totalMigrated += migratedCount;
    }

    return NextResponse.json({
      success: true,
      mode: execute ? 'EXECUTE' : 'DRY_RUN',
      targetUserId: uid,
      results,
      totalMigrated
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
