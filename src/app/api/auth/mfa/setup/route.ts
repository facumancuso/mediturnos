import { NextResponse } from 'next/server';
import { generateSecret, generateURI } from 'otplib';
import { getMongoDb } from '@/lib/mongodb';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { encryptSecret } from '@/lib/mfa-security';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'auth:mfa:setup',
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
    const db = await getMongoDb();

    const secret = generateSecret();
    const issuer = 'MediTurnos';
    const label = decodedToken.phone_number || decodedToken.email || decodedToken.uid;
    const otpauthUrl = generateURI({ issuer, label, secret });

    const now = new Date();
    const pendingExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await db.collection('mfa_factors').updateOne(
      { uid: decodedToken.uid },
      {
        $set: {
          uid: decodedToken.uid,
          pendingSecretEncrypted: encryptSecret(secret),
          pendingExpiresAt,
          updatedAt: now,
        },
        $setOnInsert: {
          enabled: false,
          backupCodeHashes: [],
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      otpauthUrl,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error('Error iniciando setup MFA:', error);
    return NextResponse.json({ error: 'No se pudo iniciar el setup MFA.' }, { status: 500 });
  }
}
