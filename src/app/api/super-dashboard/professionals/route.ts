import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:professionals:get',
    identifier: 'superadmin-professionals',
    limit: 120,
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
    // Validate superadmin
    await requireSuperAdminRequest(request);

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await getMongoDb();
    const professionalsCollection = db.collection('professionals');

    // Build filter
    const filter: any = {
      $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: { $ne: true } }],
    };
    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    // Get total count
    const total = await professionalsCollection.countDocuments(filter);

    // Get professionals
    const professionals = await professionalsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Map to ManagedProfessional format
    const mapped = professionals.map((prof: any) => {
      // Determinar plan basado en datos disponibles (por defecto: Profesional)
      let plan = 'Profesional';

      // Determinar estado (por defecto: Activa)
      let status = 'Activa';
      if (prof.isActive === 'False' || prof.isActive === false) {
        status = 'Bloqueada';
      }

      return {
        id: prof._id?.toString() || prof.id || '',
        name: prof.name || 'Sin nombre',
        email: prof.email || '',
        phone: prof.phone || prof.whatsappNumber || '',
        dni: prof.dni || '',
        verified: !!prof.publicProfile?.verified,
        plan,
        status,
        avatarUrl: prof.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${prof.email}`,
        appointmentCount: prof.appointmentCount || 0,
        appointmentLimit: prof.appointmentLimit || 'unlimited',
        trialEndsAt: prof.trialEndsAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        lastPayment: prof.lastPayment || new Date().toISOString().split('T')[0],
        createdAt: prof.createdAt ? new Date(prof.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json(
      {
        professionals: mapped,
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SuperAdmin Professionals API Error]', error);

    if (error instanceof Error && error.message.includes('Superadmin')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Error retrieving professionals.' },
      { status: 500 }
    );
  }
}
