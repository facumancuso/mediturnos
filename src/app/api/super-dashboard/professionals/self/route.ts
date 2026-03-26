import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

export async function PATCH(request: NextRequest) {
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:professionals:self:patch',
    identifier: 'superadmin-self-professional-cleanup',
    limit: 30,
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
    const authUser = await requireSuperAdminRequest(request);
    const db = await getMongoDb();

    await db.collection('professionals').updateMany(
      {
        $or: [
          { id: authUser.uid },
          { userId: authUser.uid },
          ...(authUser.email ? [{ email: authUser.email }] : []),
        ],
      },
      {
        $set: {
          isSuperAdmin: true,
          role: 'super_admin',
          'publicProfile.enabled': false,
          'publicProfile.verified': false,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SuperAdmin Self Cleanup API Error]', error);

    if (error instanceof Error && error.message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'No se pudo sanear el perfil super-admin.' }, { status: 500 });
  }
}
