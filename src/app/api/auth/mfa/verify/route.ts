import { NextResponse } from 'next/server';
import { verify } from 'otplib';
import { getMongoDb } from '@/lib/mongodb';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { decryptSecret, hashBackupCode } from '@/lib/mfa-security';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'auth:mfa:verify',
      limit: 30,
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
    const code = String(body?.code || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Código requerido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const record = await db.collection('mfa_factors').findOne({ uid: decodedToken.uid });

    if (!record?.enabled) {
      return NextResponse.json({ error: 'MFA no habilitado.' }, { status: 400 });
    }

    let verified = false;
    let remainingBackupCodeHashes: string[] | null = null;

    if (/^\d{6}$/.test(code) && record.secretEncrypted) {
      const secret = decryptSecret(record.secretEncrypted);
      verified = await verify({ token: code, secret });
    }

    if (!verified && Array.isArray(record.backupCodeHashes)) {
      const candidateHash = hashBackupCode(code);
      if (record.backupCodeHashes.includes(candidateHash)) {
        verified = true;
        remainingBackupCodeHashes = record.backupCodeHashes.filter(
          (backupCodeHash: string) => backupCodeHash !== candidateHash
        );
      }
    }

    if (!verified) {
      return NextResponse.json({ error: 'Código MFA inválido.' }, { status: 400 });
    }

    if (remainingBackupCodeHashes) {
      await db.collection('mfa_factors').updateOne(
        { uid: decodedToken.uid },
        {
          $set: {
            backupCodeHashes: remainingBackupCodeHashes,
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Error verificando MFA:', error);
    return NextResponse.json({ error: 'No se pudo verificar MFA.' }, { status: 500 });
  }
}
