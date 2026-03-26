import { NextResponse } from 'next/server';
import { verify } from 'otplib';
import { getMongoDb } from '@/lib/mongodb';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { decryptSecret, encryptSecret, generateBackupCodes, hashBackupCode } from '@/lib/mfa-security';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'auth:mfa:enable',
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const decodedToken = await verifyFirebaseIdToken(request.headers.get('authorization'));
    const body = await request.json();
    const code = String(body?.code || '').trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const record = await db.collection('mfa_factors').findOne({ uid: decodedToken.uid });

    if (!record?.pendingSecretEncrypted || !record?.pendingExpiresAt) {
      return NextResponse.json({ error: 'No hay setup MFA pendiente.' }, { status: 400 });
    }

    if (new Date(record.pendingExpiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'El setup MFA expiró. Inicia nuevamente.' }, { status: 400 });
    }

    const secret = decryptSecret(record.pendingSecretEncrypted);
    const isValid = await verify({ token: code, secret });
    if (!isValid) {
      return NextResponse.json({ error: 'Código TOTP inválido.' }, { status: 400 });
    }

    const backupCodes = generateBackupCodes(10);
    const backupCodeHashes = backupCodes.map(hashBackupCode);
    const now = new Date();

    await db.collection('mfa_factors').updateOne(
      { uid: decodedToken.uid },
      {
        $set: {
          uid: decodedToken.uid,
          enabled: true,
          secretEncrypted: encryptSecret(secret),
          backupCodeHashes,
          enabledAt: now,
          updatedAt: now,
        },
        $unset: {
          pendingSecretEncrypted: '',
          pendingExpiresAt: '',
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      enabled: true,
      backupCodes,
    });
  } catch (error) {
    console.error('Error habilitando MFA:', error);
    return NextResponse.json({ error: 'No se pudo habilitar MFA.' }, { status: 500 });
  }
}
