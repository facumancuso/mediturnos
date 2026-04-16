import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function mapPublic(doc: Record<string, any>, professional?: Record<string, any> | null) {
  return {
    id: doc._id?.toString() ?? doc.id,
    date: doc.date,
    time: doc.time,
    duration: doc.duration,
    type: doc.type,
    status: doc.status,
    patientResponse: doc.patientResponse ?? null,
    patientRespondedAt: doc.patientRespondedAt ?? null,
    reminderSentAt: doc.reminderSentAt ?? null,
    patientName: doc.patientName,
    cancelledAt: doc.cancelledAt ?? null,
    professionalName: professional?.name ?? null,
    professionalAddress: professional?.address ?? null,
    professionalWhatsappNumber: professional?.whatsappNumber ?? null,
    professionalSlug: professional?.publicProfile?.slug ?? null,
    professionalMapUrl: professional?.publicProfile?.mapUrl ?? null,
  };
}

async function resolveObjectId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// GET /api/patient/appointment/[id]
// Returns the appointment for the reminder page — no auth required.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await enforceRateLimit({
      request,
      keyPrefix: 'patient:appointment:get',
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const { id } = await params;
    const objectId = await resolveObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'ID de turno inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const appointment = await db.collection('appointments').findOne({ _id: objectId });

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: appointment.professionalId }, { userId: appointment.professionalId }] },
      { projection: { name: 1, address: 1, whatsappNumber: 1, 'publicProfile.slug': 1, 'publicProfile.mapUrl': 1 } }
    );

    return NextResponse.json(mapPublic(appointment, professional));
  } catch (error) {
    console.error('Error obteniendo turno público:', error);
    return NextResponse.json({ error: 'No se pudo obtener el turno.' }, { status: 500 });
  }
}

// PATCH /api/patient/appointment/[id]
// Body: { action: 'confirm' | 'cancel' }
// Used by the direct reminder link — validates only by appointmentId (ObjectId entropy is auth enough).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await enforceRateLimit({
      request,
      keyPrefix: 'patient:appointment:patch',
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const { id } = await params;
    const objectId = await resolveObjectId(id);
    if (!objectId) {
      return NextResponse.json({ error: 'ID de turno inválido.' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body || {};

    if (action !== 'confirm' && action !== 'cancel') {
      return NextResponse.json(
        { error: 'action debe ser "confirm" o "cancel".' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const appointment = await db.collection('appointments').findOne({ _id: objectId });

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }

    if (appointment.status === 'completed' || appointment.status === 'no_show') {
      return NextResponse.json(
        { error: 'Este turno ya no puede modificarse.' },
        { status: 400 }
      );
    }

    if (appointment.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Este turno ya fue cancelado.' },
        { status: 400 }
      );
    }

    if (appointment.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Solo podés responder un turno cuando esté confirmado por el profesional.' },
        { status: 400 }
      );
    }

    if (appointment.patientResponse) {
      return NextResponse.json(
        { error: 'Este turno ya fue respondido anteriormente.' },
        { status: 400 }
      );
    }

    const respondedAt = new Date().toISOString();
    const setFields: Record<string, any> = {
      updatedAt: new Date(),
      patientResponse: action === 'confirm' ? 'confirmed' : 'declined',
      patientRespondedAt: respondedAt,
      patientResponsePendingNotification: true,
    };
    if (action === 'cancel') {
      setFields.status = 'cancelled';
      setFields.cancelledAt = respondedAt;
    }

    await db.collection('appointments').updateOne({ _id: objectId }, { $set: setFields });

    const updated = await db.collection('appointments').findOne({ _id: objectId });
    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: appointment.professionalId }, { userId: appointment.professionalId }] },
      { projection: { name: 1, address: 1, whatsappNumber: 1, 'publicProfile.slug': 1, 'publicProfile.mapUrl': 1 } }
    );
    return NextResponse.json(mapPublic(updated!, professional));
  } catch (error) {
    console.error('Error actualizando turno público:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el turno.' }, { status: 500 });
  }
}
