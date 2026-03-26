import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ professionalId: string }> }
) {
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:professionals:verification:patch',
    identifier: 'superadmin-professional-verification',
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const admin = await requireSuperAdminRequest(request);
    const { professionalId } = await params;
    const body = await request.json();
    const verified = body?.verified;

    if (typeof verified !== 'boolean') {
      return NextResponse.json({ error: 'verified debe ser boolean.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const professionals = db.collection('professionals');

    const match: Record<string, any> = {
      $or: [{ id: professionalId }, { userId: professionalId }],
    };

    if (ObjectId.isValid(professionalId)) {
      match.$or.push({ _id: new ObjectId(professionalId) });
    }

    const current = await professionals.findOne(match);
    if (!current) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    await professionals.updateOne(
      { _id: current._id },
      {
        $set: {
          'publicProfile.verified': verified,
          verificationUpdatedAt: new Date(),
          verificationUpdatedBy: admin.uid,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await professionals.findOne({ _id: current._id });

    return NextResponse.json({
      ok: true,
      professionalId: updated?.id || updated?._id?.toString() || professionalId,
      verified: !!updated?.publicProfile?.verified,
    });
  } catch (error) {
    console.error('[SuperAdmin Verification API Error]', error);

    if (error instanceof Error && error.message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'No se pudo actualizar la verificación del profesional.' },
      { status: 500 }
    );
  }
}
