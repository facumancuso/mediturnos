import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { isRequestSuperAdmin } from '@/lib/super-admin-request';
import { logSecurityAudit } from '@/lib/security-audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { PROFESSIONAL_BRAND_COVER_URL } from '@/lib/branding';

export const dynamic = 'force-dynamic';

const PROFESSIONAL_CACHE_TTL_MS = 30_000;
const professionalCache = new Map<string, { expiresAt: number; payload: Record<string, any> }>();

function mapDocument(doc: Record<string, any>) {
  return {
    ...doc,
    coverImageUrl: PROFESSIONAL_BRAND_COVER_URL,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const isSuperAdmin = await isRequestSuperAdmin(request, authUser.uid);
    if (isSuperAdmin) {
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

    const cached = professionalCache.get(professionalId);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
          'X-Data-Cache': 'hit',
        },
      });
    }

    const professional = await db.collection('professionals').findOne({
      $or: [{ id: professionalId }, { userId: professionalId }],
    });

    if (!professional) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    const payload = mapDocument(professional);
    professionalCache.set(professionalId, {
      expiresAt: Date.now() + PROFESSIONAL_CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        'X-Data-Cache': 'miss',
      },
    });
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
    const isSuperAdmin = await isRequestSuperAdmin(request, authUser.uid);
    if (isSuperAdmin) {
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
      coverImageUrl: PROFESSIONAL_BRAND_COVER_URL,
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

    professionalCache.delete(id);

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
    const isSuperAdmin = await isRequestSuperAdmin(request, authUser.uid);
    if (isSuperAdmin) {
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
      appointmentDuration,
      workingHours,
      whatsappNumber,
      address,
      photoURL,
      publicProfile,
      blockedDates,
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
          ...(typeof appointmentDuration === 'number' && Number.isFinite(appointmentDuration) && appointmentDuration > 0
            ? { appointmentDuration }
            : {}),
          ...(typeof workingHours === 'string' ? { workingHours } : {}),
          ...(typeof whatsappNumber === 'string' ? { whatsappNumber } : {}),
          ...(typeof address === 'string' ? { address } : {}),
          ...(typeof photoURL === 'string' ? { photoURL } : {}),
          coverImageUrl: PROFESSIONAL_BRAND_COVER_URL,
          ...(Array.isArray(blockedDates)
            ? {
                blockedDates: blockedDates
                  .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
                  .slice(0, 500),
              }
            : {}),
          publicProfile: mergedPublicProfile,
          updatedAt: now,
        },
      }
    );

    professionalCache.delete(professionalId);

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
