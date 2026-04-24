import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getOptionalRequestAuth } from '@/lib/request-auth';
import { logSecurityAudit } from '@/lib/security-audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { syncAppointmentToGoogleCalendar } from '@/lib/google-calendar';
import {
  buildAppointmentsCacheKey,
  getCachedAppointments,
  invalidateAppointmentsReadCache,
  setCachedAppointments,
} from '@/lib/appointments-cache';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

let appointmentsIndexesReady = false;

async function ensureAppointmentsIndexes(db: Awaited<ReturnType<typeof getMongoDb>>) {
  if (appointmentsIndexesReady) return;
  await db.collection('appointments').createIndex({ professionalId: 1, date: 1, time: 1 });
  await db.collection('appointments').createIndex({ professionalId: 1, status: 1, date: 1 });
  await db.collection('appointments').createIndex({ professionalId: 1, patientId: 1, date: 1 });
  appointmentsIndexesReady = true;
}

function mapDocument(doc: Record<string, any>) {
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

function mapPublicDocument(doc: Record<string, any>) {
  return {
    id: doc.id || doc._id?.toString(),
    professionalId: doc.professionalId,
    date: doc.date,
    time: doc.time,
    duration: doc.duration,
    type: doc.type,
    status: doc.status,
  };
}

function getDateRangeForDay(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const baselineRateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:appointments:get',
      limit: 120,
      windowMs: 60_000,
    });
    if (!baselineRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(baselineRateLimit.retryAfterSeconds) } }
      );
    }

    const authUser = await getOptionalRequestAuth(request);
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const day = searchParams.get('day');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const statusFilter = searchParams.get('status');
    const patientIdFilter = searchParams.get('patientId');
    const onlyDates = searchParams.get('onlyDates') === 'true';

    if (!professionalId) {
      return NextResponse.json({ error: 'professionalId es obligatorio.' }, { status: 400 });
    }

    const isAuthenticatedDashboardRequest = !!authUser;

    if (isAuthenticatedDashboardRequest && professionalId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/appointments',
        method: 'GET',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de consultar turnos de otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para consultar estos turnos.' }, { status: 403 });
    }

    if (!isAuthenticatedDashboardRequest && !day) {
      await logSecurityAudit(request, {
        type: 'unauthorized_access',
        endpoint: '/api/dashboard/appointments',
        method: 'GET',
        requestedProfessionalId: professionalId,
        reason: 'Intento público de consulta de turnos fuera del modo disponibilidad por día.',
      });
      return NextResponse.json(
        { error: 'Acceso público permitido solo para consultas de disponibilidad por día.' },
        { status: 401 }
      );
    }

    const query: Record<string, any> = { professionalId };

    if (day) {
      const { start, end } = getDateRangeForDay(day);
      query.date = { $gte: start, $lte: end };
    } else if (start && end) {
      const parsedStart = new Date(start);
      const parsedEnd = new Date(end);

      if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
        return NextResponse.json(
          { error: 'Rango de fechas inválido. Usa formato ISO para start y end.' },
          { status: 400 }
        );
      }

      query.date = { $gte: parsedStart, $lte: parsedEnd };
    }

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (patientIdFilter) {
      query.patientId = { $in: [patientIdFilter, `public-${patientIdFilter}`] };
    }

    const db = await getMongoDb();
    await ensureAppointmentsIndexes(db);

    const cacheKey = buildAppointmentsCacheKey({
      professionalId,
      day,
      start,
      end,
      status: statusFilter,
      patientId: patientIdFilter,
      isPublic: !isAuthenticatedDashboardRequest,
      onlyDates,
    });

    const cacheControlHeader = onlyDates
      ? 'private, max-age=60, stale-while-revalidate=300'
      : 'private, max-age=5, stale-while-revalidate=20';

    const cachedPayload = getCachedAppointments<unknown[]>(cacheKey);
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: {
          'Cache-Control': cacheControlHeader,
          'X-Data-Cache': 'hit',
        },
      });
    }

    const appointments = await db
      .collection('appointments')
      .find(query)
      .project(onlyDates ? { date: 1, status: 1, _id: 0 } : {})
      .sort({ date: 1, time: 1 })
      .toArray();

    const payload = onlyDates
      ? appointments.map((doc) => ({ date: doc.date, status: doc.status }))
      : !isAuthenticatedDashboardRequest
        ? appointments.map(mapPublicDocument)
        : appointments.map(mapDocument);

    setCachedAppointments(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': cacheControlHeader,
        'X-Data-Cache': 'miss',
      },
    });
  } catch (error) {
    console.error('Error obteniendo turnos desde MongoDB:', error);
    return NextResponse.json({ error: 'No se pudieron obtener los turnos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const baselineRateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:appointments:post',
      limit: 80,
      windowMs: 60_000,
    });
    if (!baselineRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(baselineRateLimit.retryAfterSeconds) } }
      );
    }

    const authUser = await getOptionalRequestAuth(request);
    const body = await request.json();
    const {
      professionalId,
      patientId,
      patientName,
      patientDni,
      patientEmail,
      patientPhone,
      patientAvatarUrl,
      date,
      time,
      duration,
      type,
      status,
    } = body || {};

    if (!professionalId || !patientId || !patientName || !date || !time || !duration || !type) {
      return NextResponse.json({ error: 'Faltan campos obligatorios del turno.' }, { status: 400 });
    }

    const isPublicBooking = !authUser;

    if (authUser && professionalId !== authUser.uid) {
      await logSecurityAudit(request, {
        type: 'forbidden_access',
        endpoint: '/api/dashboard/appointments',
        method: 'POST',
        actorUid: authUser.uid,
        actorEmail: authUser.email,
        requestedProfessionalId: professionalId,
        reason: 'Intento de crear turno para otro profesional.',
      });
      return NextResponse.json({ error: 'No autorizado para crear turnos de otro profesional.' }, { status: 403 });
    }

    if (isPublicBooking && !String(patientId).startsWith('public-')) {
      await logSecurityAudit(request, {
        type: 'unauthorized_access',
        endpoint: '/api/dashboard/appointments',
        method: 'POST',
        requestedProfessionalId: professionalId,
        reason: 'Intento público de crear turno sin identificador público permitido.',
      });
      return NextResponse.json({ error: 'No autorizado para crear este turno.' }, { status: 403 });
    }

    if (isPublicBooking) {
      const publicBookingRateLimit = await enforceRateLimit({
        request,
        keyPrefix: `public:booking:${professionalId}`,
        limit: 20,
        windowMs: 10 * 60_000,
      });
      if (!publicBookingRateLimit.allowed) {
        return NextResponse.json(
          { error: 'Demasiadas solicitudes de turnos. Intenta nuevamente más tarde.' },
          { status: 429, headers: { 'Retry-After': String(publicBookingRateLimit.retryAfterSeconds) } }
        );
      }
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'La fecha del turno es inválida.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const now = new Date();

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: professionalId }, { userId: professionalId }] },
      { projection: { blockedDates: 1 } }
    );

    const appointmentDayKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
    const blockedDates = Array.isArray(professional?.blockedDates) ? professional.blockedDates : [];

    if (blockedDates.includes(appointmentDayKey)) {
      return NextResponse.json(
        { error: 'El profesional no atiende en la fecha seleccionada.' },
        { status: 409 }
      );
    }

    let resolvedPatientId = patientId;

    if (isPublicBooking && patientDni) {
      const dni = String(patientDni).replace(/\./g, '');
      const existing = await db.collection('patients').findOne({ professionalId, id: dni });
      if (existing) {
        resolvedPatientId = existing.id;
      }
    }

    const appointment = {
      professionalId,
      patientId: resolvedPatientId,
      patientName,
      patientAvatarUrl: patientAvatarUrl || '',
      date: parsedDate,
      time,
      duration,
      type: isPublicBooking ? 'first_time' : type,
      status: isPublicBooking ? 'pending' : (status || 'confirmed'),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('appointments').insertOne(appointment);

    let googleCalendarSync: { synced: boolean; reason?: string; eventId?: string } | null = null;

    if (!isPublicBooking && appointment.status === 'confirmed') {
      const professional = await db.collection('professionals').findOne(
        { $or: [{ id: professionalId }, { userId: professionalId }] },
        { projection: { name: 1, address: 1 } }
      );

      googleCalendarSync = await syncAppointmentToGoogleCalendar({
        db,
        professionalId,
        appointmentObjectId: result.insertedId,
        appointment,
        professionalName: String(professional?.name || 'Profesional'),
        professionalAddress: String(professional?.address || ''),
      });
    }

    if (isPublicBooking && patientDni && patientEmail && patientPhone) {
      const dni = String(patientDni).replace(/\./g, '');
      await db.collection('patients').updateOne(
        { professionalId, id: dni },
        {
          $setOnInsert: {
            professionalId,
            id: dni,
            dni,
            name: patientName,
            email: patientEmail,
            phone: patientPhone,
            insurance: 'Particular',
            lastVisit: now.toISOString(),
            totalVisits: 0,
            missedAppointments: 0,
            avatarUrl: `https://picsum.photos/seed/${dni}/100/100`,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }

    invalidateAppointmentsReadCache(professionalId);

    const saved = await db.collection('appointments').findOne({ _id: result.insertedId });

    return NextResponse.json(
      {
        ...mapDocument(saved || appointment),
        googleCalendarSync,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('UNAUTHORIZED') || error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error creando turno en MongoDB:', error);
    return NextResponse.json({ error: 'No se pudo crear el turno.' }, { status: 500 });
  }
}
