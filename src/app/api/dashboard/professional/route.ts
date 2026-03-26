import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { logSecurityAudit } from '@/lib/security-audit';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function isSuperAdminEmail(email?: string | null) {
  const normalized = (email || '').toLowerCase();
  const configured = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'admin@mediturnos.com').toLowerCase();
  return normalized !== '' && normalized === configured;
}

function mapDocument(doc: Record<string, any>) {
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    if (isSuperAdminEmail(authUser.email)) {
      return NextResponse.json(
        { error: 'Super Admin no tiene acceso al perfil profesional.' },
        { status: 403 }
      );
    }
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:professional:get',
      identifier: authUser.uid,
      limit: 120,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');

    if (!professionalId) {
      return NextResponse.json({ error: 'professionalId es obligatorio.' }, { status: 400 });
    }

    if (professionalId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/professional',
        method: 'GET',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de consultar perfil de otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para este profesional.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const professional = await db.collection('professionals').findOne({
      $or: [{ id: professionalId }, { userId: professionalId }],
    });

    if (!professional) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(mapDocument(professional));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error obteniendo profesional desde MongoDB:', error);
    return NextResponse.json(
      { error: 'No se pudo obtener el profesional.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    if (isSuperAdminEmail(authUser.email)) {
      return NextResponse.json(
        { error: 'Super Admin no puede crear perfil profesional.' },
        { status: 403 }
      );
    }
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:professional:post',
      identifier: authUser.uid,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const {
      id,
      userId,
      name,
      email,
      specialty,
      whatsappNumber,
      address,
      photoURL,
      coverImageUrl,
      publicProfile,
    } = body || {};

    if (!id || !name) {
      return NextResponse.json({ error: 'id y name son obligatorios.' }, { status: 400 });
    }

    const ownerId = userId || id;
    if (id !== authUser.uid || ownerId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/professional',
        method: 'POST',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: String(ownerId),
        reason: 'Intento de crear/actualizar profesional con UID distinto al autenticado.',
      });
      return NextResponse.json({ error: 'No autorizado para crear este profesional.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const now = new Date();

    const professional = {
      id,
      userId: userId || id,
      name,
      email: email || '',
      role: 'professional_owner',
      specialty: specialty || 'No especificada',
      licenseNumber: 'N/A',
      whatsappNumber: whatsappNumber || '',
      address: address || 'No especificada',
      photoURL: photoURL || `https://picsum.photos/seed/${id}/100/100`,
      coverImageUrl: coverImageUrl || `https://picsum.photos/seed/${id}-cover/600/200`,
      appointmentDuration: 30,
      publicProfile: {
        enabled: true,
        verified: false,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        bio: '',
        insurances: [],
        rating: 0,
        reviewCount: 0,
        mapUrl: '',
        ...publicProfile,
      },
      isActive: true,
      updatedAt: now,
    };

    await db.collection('professionals').updateOne(
      { id },
      { $set: professional, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    const saved = await db.collection('professionals').findOne({ id });
    return NextResponse.json(mapDocument(saved || professional), { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error creando profesional en MongoDB:', error);
    return NextResponse.json({ error: 'No se pudo crear el perfil profesional.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    if (isSuperAdminEmail(authUser.email)) {
      return NextResponse.json(
        { error: 'Super Admin no puede editar perfil profesional.' },
        { status: 403 }
      );
    }
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:professional:patch',
      identifier: authUser.uid,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const {
      professionalId,
      name,
      dni,
      specialty,
      whatsappNumber,
      address,
      photoURL,
      coverImageUrl,
      publicProfile,
    } = body || {};

    if (!professionalId) {
      return NextResponse.json({ error: 'professionalId es obligatorio.' }, { status: 400 });
    }

    if (professionalId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/professional',
        method: 'PATCH',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de actualizar perfil de otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para actualizar este profesional.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const now = new Date();

    const current = await db.collection('professionals').findOne({
      $or: [{ id: professionalId }, { userId: professionalId }],
    });

    if (!current) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    const incomingPublicProfile = (publicProfile || {}) as Record<string, any>;
    const {
      verified: _ignoredVerified,
      ...safePublicProfileUpdate
    } = incomingPublicProfile;

    const currentName = String(name || current.name || 'profesional');
    const mergedPublicProfile = {
      enabled: current.publicProfile?.enabled ?? true,
      verified: current.publicProfile?.verified ?? false,
      slug:
        current.publicProfile?.slug ||
        currentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      bio: current.publicProfile?.bio || '',
      insurances: current.publicProfile?.insurances || [],
      rating: current.publicProfile?.rating || 0,
      reviewCount: current.publicProfile?.reviewCount || 0,
      mapUrl: current.publicProfile?.mapUrl || '',
      ...safePublicProfileUpdate,
    };

    await db.collection('professionals').updateOne(
      { _id: current._id },
      {
        $set: {
          ...(name ? { name } : {}),
          ...(dni ? { dni } : {}),
          ...(specialty ? { specialty } : {}),
          ...(typeof whatsappNumber === 'string' ? { whatsappNumber } : {}),
          ...(typeof address === 'string' ? { address } : {}),
          ...(typeof photoURL === 'string' ? { photoURL } : {}),
          ...(typeof coverImageUrl === 'string' ? { coverImageUrl } : {}),
          publicProfile: mergedPublicProfile,
          updatedAt: now,
        },
      }
    );

    const saved = await db.collection('professionals').findOne({ _id: current._id });
    return NextResponse.json(mapDocument(saved || current));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error actualizando profesional en MongoDB:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el perfil profesional.' }, { status: 500 });
  }
}
