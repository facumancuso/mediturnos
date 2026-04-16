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

function mapAppointmentWithProfessional(
  doc: Record<string, any>,
  professional?: Record<string, any> | null
) {
  return {
    ...mapDocument(doc),
    professionalName: professional?.name ?? null,
    professionalAddress: professional?.address ?? null,
    professionalWhatsappNumber: professional?.whatsappNumber ?? null,
    professionalSlug: professional?.publicProfile?.slug ?? null,
    professionalMapUrl: professional?.publicProfile?.mapUrl ?? null,
  };
}

async function findPatientByIdentity(db: Awaited<ReturnType<typeof getMongoDb>>, lookup: PatientLookup) {
  const dni = normalizeDni(lookup.dni || '');

  if (!dni) {
    return null;
  }

  return db.collection('patients').findOne({ id: dni }) || null;
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
    const dni = searchParams.get('dni') || '';
  const activeOnly = ['1', 'true', 'yes'].includes((searchParams.get('activeOnly') || '').toLowerCase());

    if (!dni) {
      return NextResponse.json(
        { error: 'El DNI es obligatorio.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const patient = await findPatientByIdentity(db, { dni });

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    }

    const appointmentQuery: Record<string, any> = {
      professionalId: patient.professionalId,
      patientId: { $in: [patient.id, `public-${patient.id}`] },
    };

    if (activeOnly) {
      appointmentQuery.status = { $in: ['pending', 'confirmed'] };
    }

    const appointments = await db
      .collection('appointments')
      .find(appointmentQuery)
      .sort({ date: 1, time: 1 })
      .toArray();

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: patient.professionalId }, { userId: patient.professionalId }] },
      { projection: { name: 1, address: 1, whatsappNumber: 1, 'publicProfile.slug': 1, 'publicProfile.mapUrl': 1 } }
    );

    return NextResponse.json({
      patient: mapDocument(patient),
      appointments: appointments.map((appointment) => mapAppointmentWithProfessional(appointment, professional)),
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
    const { appointmentId, action, dni } = body || {};

    if (!appointmentId || !action || !dni) {
      return NextResponse.json(
        { error: 'appointmentId, action y dni son obligatorios.' },
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
    const patient = await findPatientByIdentity(db, { dni });

    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    }

    const objectId = ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : null;

    const appointment = await db.collection('appointments').findOne({
      ...(objectId ? { _id: objectId } : { id: appointmentId }),
      professionalId: patient.professionalId,
      patientId: { $in: [patient.id, `public-${patient.id}`] },
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
    const statusUpdate = action === 'cancel' ? 'cancelled' : appointment.status;

    await db.collection('appointments').updateOne(
      { _id: appointment._id },
      {
        $set: {
          status: statusUpdate,
          patientResponse: action === 'confirm' ? 'confirmed' : 'declined',
          patientRespondedAt: respondedAt,
          patientResponsePendingNotification: true,
          ...(action === 'cancel' ? { cancelledAt: respondedAt } : {}),
          updatedAt: new Date(),
        },
      }
    );

    const updated = await db.collection('appointments').findOne({ _id: appointment._id });

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: patient.professionalId }, { userId: patient.professionalId }] },
      { projection: { name: 1, address: 1, whatsappNumber: 1, 'publicProfile.slug': 1, 'publicProfile.mapUrl': 1 } }
    );

    return NextResponse.json(mapAppointmentWithProfessional(updated || appointment, professional));
  } catch (error) {
    console.error('Error actualizando turno desde portal paciente:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el turno.' }, { status: 500 });
  }
}
