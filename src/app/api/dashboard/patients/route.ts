import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { logSecurityAudit } from '@/lib/security-audit';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

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
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:patients:get',
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
        endpoint: '/api/dashboard/patients',
        method: 'GET',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de consultar pacientes de otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para consultar estos pacientes.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const patients = await db
      .collection('patients')
      .find({ professionalId })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(patients.map(mapDocument));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error obteniendo pacientes desde MongoDB:', error);
    return NextResponse.json({ error: 'No se pudieron obtener los pacientes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:patients:post',
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
      id,
      dni,
      name,
      email,
      phone,
      insurance,
      lastVisit,
      totalVisits,
      missedAppointments,
      avatarUrl,
    } = body || {};

    if (!professionalId || !id || !dni || !name || !email || !phone) {
      return NextResponse.json({ error: 'Faltan campos obligatorios del paciente.' }, { status: 400 });
    }

    if (professionalId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/patients',
        method: 'POST',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de crear paciente para otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para crear pacientes de otro profesional.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const now = new Date();

    const patient = {
      professionalId,
      id,
      dni,
      name,
      email,
      phone,
      insurance: insurance || 'Particular',
      lastVisit: lastVisit || now.toISOString(),
      totalVisits: Number.isFinite(totalVisits) ? totalVisits : 0,
      missedAppointments: Number.isFinite(missedAppointments) ? missedAppointments : 0,
      avatarUrl: avatarUrl || `https://picsum.photos/seed/${id}/100/100`,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('patients').updateOne(
      { professionalId, id },
      { $set: patient, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    const saved = await db.collection('patients').findOne({ professionalId, id });
    return NextResponse.json(mapDocument(saved || patient), { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error creando paciente en MongoDB:', error);
    return NextResponse.json({ error: 'No se pudo crear el paciente.' }, { status: 500 });
  }
}
