import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendWhatsAppMessage, buildConfirmationMessage, buildReminderMessage, buildRatingRequestMessage } from '@/lib/whatsapp';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { removeAppointmentFromGoogleCalendar, syncAppointmentToGoogleCalendar } from '@/lib/google-calendar';
import { invalidateAppointmentsReadCache } from '@/lib/appointments-cache';
import { createRatingRequestToken, getRatingRequestExpiryDate } from '@/lib/reviews';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireRequestAuth(request);
    const { id } = await params;

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!objectId) {
      return NextResponse.json({ error: 'ID de turno inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const appointment = await db.collection('appointments').findOne({ _id: objectId });

    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }
    if (appointment.professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const googleSync = await removeAppointmentFromGoogleCalendar({
      db,
      professionalId: authUser.uid,
      appointment,
      appointmentObjectId: objectId,
    });

    await db.collection('appointments').deleteOne({ _id: objectId });
    invalidateAppointmentsReadCache(authUser.uid);

    return NextResponse.json({ success: true, googleCalendarSync: googleSync });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error eliminando turno:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el turno.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

function mapDocument(doc: Record<string, any>) {
  return { ...doc, id: doc.id || doc._id?.toString(), _id: undefined };
}

function getDateRangeForDay(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { start, end };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireRequestAuth(request);
    const { id: appointmentId } = await params;

    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:appointment:patch',
      identifier: authUser.uid,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { action } = body || {};

    if (!action || !['confirm', 'pending', 'cancel', 'complete', 'no_show', 'send_reminder', 'send_rating_request', 'reschedule', 'update'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser confirm, pending, cancel, complete, no_show, send_reminder, send_rating_request, reschedule o update.' },
        { status: 400 }
      );
    }

    const objectId = ObjectId.isValid(appointmentId) ? new ObjectId(appointmentId) : null;
    if (!objectId) {
      return NextResponse.json({ error: 'ID de turno inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();

    const appointment = await db.collection('appointments').findOne({ _id: objectId });
    if (!appointment) {
      return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
    }

    if (appointment.professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (action === 'reschedule') {
      const nextDateRaw = String(body?.date || '').trim();
      const nextTimeRaw = String(body?.time || '').trim();
      const nextDuration = Number(body?.duration || appointment.duration || 30);

      if (!nextDateRaw || !nextTimeRaw) {
        return NextResponse.json(
          { error: 'Para reprogramar se requieren date y time.' },
          { status: 400 }
        );
      }

      if (!/^\d{2}:\d{2}$/.test(nextTimeRaw)) {
        return NextResponse.json({ error: 'La hora es inválida.' }, { status: 400 });
      }

      const parsedDate = new Date(`${nextDateRaw}T00:00:00`);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'La fecha es inválida.' }, { status: 400 });
      }

      const [hours, minutes] = nextTimeRaw.split(':').map(Number);
      parsedDate.setHours(hours, minutes, 0, 0);

      const professional = await db.collection('professionals').findOne(
        { $or: [{ id: authUser.uid }, { userId: authUser.uid }] },
        { projection: { blockedDates: 1, name: 1, address: 1 } }
      );

      const blockedDates = Array.isArray(professional?.blockedDates) ? professional.blockedDates : [];
      if (blockedDates.includes(nextDateRaw)) {
        return NextResponse.json(
          { error: 'No podés reprogramar en un día marcado como no laborable.' },
          { status: 409 }
        );
      }

      const { start, end } = getDateRangeForDay(nextDateRaw);
      const collision = await db.collection('appointments').findOne({
        _id: { $ne: objectId },
        professionalId: authUser.uid,
        date: { $gte: start, $lte: end },
        time: nextTimeRaw,
        status: { $ne: 'cancelled' },
      });

      if (collision) {
        return NextResponse.json(
          { error: 'Ya existe un turno en ese horario.' },
          { status: 409 }
        );
      }

      const rescheduleFields: Record<string, any> = {
        date: parsedDate,
        time: nextTimeRaw,
        duration: Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : appointment.duration,
        updatedAt: new Date(),
      };

      const patientResponseRaw = body?.patientResponse;
      const hasExplicitResponse = patientResponseRaw === 'confirmed' || patientResponseRaw === 'declined';

      if (hasExplicitResponse) {
        rescheduleFields.patientResponse = patientResponseRaw;
        rescheduleFields.patientRespondedAt = new Date().toISOString();
      }

      const updateOp: Record<string, any> = { $set: rescheduleFields };
      if (!hasExplicitResponse) {
        // Clear any previous patient response — the appointment changed time,
        // so the patient's prior confirmation/decline no longer applies.
        updateOp.$unset = { patientResponse: '', patientRespondedAt: '' };
      }

      await db.collection('appointments').updateOne({ _id: objectId }, updateOp);

      const updated = await db.collection('appointments').findOne({ _id: objectId });

      let googleCalendarSync: Awaited<ReturnType<typeof syncAppointmentToGoogleCalendar>> | null = null;
      if (updated && updated.status !== 'cancelled') {
        googleCalendarSync = await syncAppointmentToGoogleCalendar({
          db,
          professionalId: authUser.uid,
          appointmentObjectId: objectId,
          appointment: updated,
          professionalName: String(professional?.name || 'Profesional'),
          professionalAddress: String(professional?.address || ''),
        });
        if (googleCalendarSync && !googleCalendarSync.synced) {
          console.warn('[Google Calendar sync] No se pudo sincronizar reprogramación:', googleCalendarSync.reason);
        }
      }

      invalidateAppointmentsReadCache(authUser.uid);

      return NextResponse.json({
        ...mapDocument(updated || appointment),
        googleCalendarSync,
      });
    }

    // ── update: edit type, notes and/or patientResponse without status change ──
    if (action === 'update') {
      const updateFields: Record<string, any> = { updatedAt: new Date() };
      const unsetFields: Record<string, ''> = {};

      if (body.type && ['first_time', 'checkup', 'urgent'].includes(String(body.type))) {
        updateFields.type = body.type;
      }
      if (typeof body.notes === 'string') {
        updateFields.notes = body.notes;
      }
      if ('patientResponse' in body) {
        if (body.patientResponse === 'confirmed' || body.patientResponse === 'declined') {
          updateFields.patientResponse = body.patientResponse;
          updateFields.patientRespondedAt = new Date().toISOString();
        } else {
          // explicit clear — patient response reset
          unsetFields.patientResponse = '';
          unsetFields.patientRespondedAt = '';
        }
      }

      const updateOp: Record<string, any> = { $set: updateFields };
      if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

      await db.collection('appointments').updateOne({ _id: objectId }, updateOp);
      const updated = await db.collection('appointments').findOne({ _id: objectId });
      invalidateAppointmentsReadCache(authUser.uid);
      return NextResponse.json(mapDocument(updated || appointment));
    }

    // ── send_reminder: no status change, just return WhatsApp link ──
    if (action === 'send_reminder') {
      await db.collection('appointments').updateOne(
        { _id: objectId },
        {
          $set: {
            reminderSentAt: new Date().toISOString(),
            updatedAt: new Date(),
          },
          $unset: {
            patientResponse: '',
            patientRespondedAt: '',
            patientResponsePendingNotification: '',
          },
        }
      );

      const patient = await db.collection('patients').findOne({
        professionalId: authUser.uid,
        $or: [
          { id: appointment.patientId },
          { id: appointment.patientId?.replace('public-', '') },
        ],
      });

      const professional = await db.collection('professionals').findOne({
        $or: [{ id: authUser.uid }, { userId: authUser.uid }],
      });

      const apptDate = new Date(appointment.date);
      const dateLabel = format(apptDate, "eeee dd 'de' MMMM", { locale: es });
      const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/estado-turno?turno=${appointmentId}`;

      const message = buildReminderMessage({
        patientName: appointment.patientName || 'Paciente',
        professionalName: professional?.name || 'el profesional',
        date: dateLabel,
        time: appointment.time,
        statusUrl,
      });

      const phone = patient?.phone || '';
      const result = await sendWhatsAppMessage({ to: phone, message });
      invalidateAppointmentsReadCache(authUser.uid);

      return NextResponse.json({
        action: 'send_reminder',
        whatsapp: result,
        patientPhone: phone,
      });
    }

    // ── send_rating_request: send WhatsApp with unique rating link ──
    if (action === 'send_rating_request') {
      if (appointment.status !== 'completed') {
        return NextResponse.json(
          { error: 'Solo se puede solicitar calificación de turnos completados.' },
          { status: 400 }
        );
      }

      if (appointment.reviewSubmittedAt || appointment.reviewId || appointment.ratingRequestUsedAt) {
        return NextResponse.json(
          { error: 'Este turno ya fue calificado y no admite una segunda reseña.' },
          { status: 409 }
        );
      }

      const patient = await db.collection('patients').findOne({
        professionalId: authUser.uid,
        $or: [
          { id: appointment.patientId },
          { id: appointment.patientId?.replace('public-', '') },
        ],
      });

      const professional = await db.collection('professionals').findOne(
        { $or: [{ id: authUser.uid }, { userId: authUser.uid }] },
        { projection: { name: 1, 'publicProfile.slug': 1 } }
      );

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const token = createRatingRequestToken();
      const expiresAt = getRatingRequestExpiryDate();
      const ratingUrl = `${appUrl}/calificar/${token}`;

      const message = buildRatingRequestMessage({
        patientName: appointment.patientName || 'Paciente',
        professionalName: professional?.name || 'el profesional',
        ratingUrl,
      });

      const phone = patient?.phone || '';
      const result = await sendWhatsAppMessage({ to: phone, message });

      await db.collection('appointments').updateOne(
        { _id: objectId },
        {
          $set: {
            ratingRequestSentAt: new Date().toISOString(),
            ratingRequestToken: token,
            ratingRequestTokenExpiresAt: expiresAt.toISOString(),
            updatedAt: new Date(),
          },
          $unset: {
            ratingRequestUsedAt: '',
          },
        }
      );
      invalidateAppointmentsReadCache(authUser.uid);

      return NextResponse.json({
        action: 'send_rating_request',
        whatsapp: result,
        patientPhone: phone,
        ratingUrl,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // ── status transitions ────────────────────────────────────────
    const statusMap: Record<string, string> = {
      confirm: 'confirmed',
      pending: 'pending',
      cancel: 'cancelled',
      complete: 'completed',
      no_show: 'no_show',
    };
    const newStatus = statusMap[action];

    const updateFields: Record<string, any> = { status: newStatus, updatedAt: new Date() };
    const unsetFields: Record<string, ''> = {};

    if (action === 'cancel') {
      updateFields.cancelledAt = new Date().toISOString();
    }

    if (action === 'pending') {
      unsetFields.cancelledAt = '';
      unsetFields.patientResponse = '';
      unsetFields.patientRespondedAt = '';
      unsetFields.patientResponsePendingNotification = '';
    }

    if (body.type && ['first_time', 'checkup', 'urgent'].includes(String(body.type))) {
      updateFields.type = body.type;
    }
    if (typeof body.notes === 'string') {
      updateFields.notes = body.notes;
    }

    const statusUpdate: Record<string, any> = { $set: updateFields };
    if (Object.keys(unsetFields).length > 0) {
      statusUpdate.$unset = unsetFields;
    }

    await db.collection('appointments').updateOne(
      { _id: objectId },
      statusUpdate
    );
    invalidateAppointmentsReadCache(authUser.uid);

    const updated = await db.collection('appointments').findOne({ _id: objectId });

    // ── on confirm: build WhatsApp + calendar links ──────────────
    let whatsapp: Awaited<ReturnType<typeof sendWhatsAppMessage>> | null = null;
    let calendarLinks: { google: string; ical: string } | null = null;

    if (action === 'confirm') {
      const patient = await db.collection('patients').findOne({
        professionalId: authUser.uid,
        $or: [
          { id: appointment.patientId },
          { id: appointment.patientId?.replace('public-', '') },
        ],
      });

      const professional = await db.collection('professionals').findOne({
        $or: [{ id: authUser.uid }, { userId: authUser.uid }],
      });

      const apptDate = new Date(appointment.date);
      const [hours, minutes] = (appointment.time as string).split(':').map(Number);
      apptDate.setHours(hours, minutes, 0, 0);

      const dateLabel = format(apptDate, "eeee dd 'de' MMMM", { locale: es });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const icalUrl = `${appUrl}/api/dashboard/appointments/${appointmentId}/calendar`;

      const googleUrl = buildGoogleCalendarUrl({
        title: `Turno con ${professional?.name || 'el profesional'}`,
        description: `Paciente: ${appointment.patientName}`,
        location: professional?.address || '',
        startDate: apptDate,
        durationMinutes: appointment.duration || 30,
      });

      calendarLinks = { google: googleUrl, ical: icalUrl };

      const message = buildConfirmationMessage({
        patientName: appointment.patientName || 'Paciente',
        professionalName: professional?.name || 'el profesional',
        date: dateLabel,
        time: appointment.time,
        calendarLinks,
      });

      const phone = patient?.phone || '';
      whatsapp = await sendWhatsAppMessage({ to: phone, message });

      if (updated) {
        const googleSync = await syncAppointmentToGoogleCalendar({
          db,
          professionalId: authUser.uid,
          appointmentObjectId: objectId,
          appointment: updated,
          professionalName: String(professional?.name || 'Profesional'),
          professionalAddress: String(professional?.address || ''),
        });

        if (!googleSync.synced) {
          console.warn('[Google Calendar sync] No se pudo sincronizar confirmación:', googleSync.reason);
        }
      }
    }

    if (action === 'cancel' && updated) {
      const googleSync = await removeAppointmentFromGoogleCalendar({
        db,
        professionalId: authUser.uid,
        appointment: updated,
        appointmentObjectId: objectId,
      });

      if (!googleSync.synced) {
        console.warn('[Google Calendar sync] No se pudo eliminar evento al cancelar turno:', googleSync.reason);
      }
    }

    return NextResponse.json({ ...mapDocument(updated || appointment), whatsapp, calendarLinks });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error actualizando turno:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el turno.' }, { status: 500 });
  }
}
