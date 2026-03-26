import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type PatientLookup = {
  fullName?: string;
  dni?: string;
  phone?: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, '');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function mapDocument(doc: Record<string, any>) {
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

async function findPatientByIdentity(db: Awaited<ReturnType<typeof getMongoDb>>, lookup: PatientLookup) {
  const fullName = normalizeText(lookup.fullName || '');
  const dni = normalizeDni(lookup.dni || '');
  const phone = normalizePhone(lookup.phone || '');

  if (!fullName || !dni || !phone) {
    return null;
  }

  const candidates = await db.collection('patients').find({ dni }).toArray();

  return (
    candidates.find((patient) => {
      const patientName = normalizeText(patient.name || '');
      const patientPhone = normalizePhone(patient.phone || '');
      return patientName === fullName && patientPhone === phone;
    }) || null
  );
}

export async function GET(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'patient:appointments:get',
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const fullName = searchParams.get('fullName') || '';
    const dni = searchParams.get('dni') || '';
    const phone = searchParams.get('phone') || '';

    if (!fullName || !dni || !phone) {
      return NextResponse.json(
        { error: 'fullName, dni y phone son obligatorios.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const patient = await findPatientByIdentity(db, { fullName, dni, phone });

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    }

    const appointments = await db
      .collection('appointments')
      .find({ professionalId: patient.professionalId, patientId: patient.id })
      .sort({ date: 1, time: 1 })
      .toArray();

    return NextResponse.json({
      patient: mapDocument(patient),
      appointments: appointments.map(mapDocument),
    });
  } catch (error) {
    console.error('Error obteniendo estado de turnos del paciente:', error);
    return NextResponse.json(
      { error: 'No se pudo obtener el estado de los turnos.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'patient:appointments:patch',
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { appointmentId, action, fullName, dni, phone } = body || {};

    if (!appointmentId || !action || !fullName || !dni || !phone) {
      return NextResponse.json(
        { error: 'appointmentId, action, fullName, dni y phone son obligatorios.' },
        { status: 400 }
      );
    }

    if (action !== 'confirm' && action !== 'cancel') {
      return NextResponse.json(
        { error: 'action debe ser "confirm" o "cancel".' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const patient = await findPatientByIdentity(db, { fullName, dni, phone });

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    }

    const objectId = ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : null;

    const appointment = await db.collection('appointments').findOne({
      ...(objectId ? { _id: objectId } : { id: appointmentId }),
      professionalId: patient.professionalId,
      patientId: patient.id,
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }

    if (appointment.status === 'completed' || appointment.status === 'no_show') {
      return NextResponse.json(
        { error: 'Este turno ya no puede modificarse.' },
        { status: 400 }
      );
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

    await db.collection('appointments').updateOne(
      { _id: appointment._id },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await db.collection('appointments').findOne({ _id: appointment._id });

    return NextResponse.json(mapDocument(updated || appointment));
  } catch (error) {
    console.error('Error actualizando turno desde portal paciente:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el turno.' }, { status: 500 });
  }
}
