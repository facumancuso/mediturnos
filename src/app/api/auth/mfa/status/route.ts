import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'auth:mfa:status',
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const decodedToken = await verifyFirebaseIdToken(request.headers.get('authorization'));
    const db = await getMongoDb();

    const record = await db.collection('mfa_factors').findOne({ uid: decodedToken.uid });

    return NextResponse.json({
      enabled: !!record?.enabled,
      hasBackupCodes: Array.isArray(record?.backupCodeHashes) && record.backupCodeHashes.length > 0,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Faltan variables Firebase Admin')
    ) {
      console.warn('MFA deshabilitado: faltan variables de Firebase Admin.');
      return NextResponse.json({ enabled: false, hasBackupCodes: false });
    }

    console.error('Error consultando estado MFA:', error);
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
}
