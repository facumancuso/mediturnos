import type { Db } from 'mongodb';
import { addDays, endOfDay, startOfDay } from 'date-fns';

const NOTIFICATIONS_SYNC_TTL_MS = 30_000;
const lastSyncByProfessional = new Map<string, number>();
const syncInFlightByProfessional = new Map<string, Promise<void>>();
let notificationsIndexesReady = false;

export type DashboardNotificationType =
  | 'pending_appointment'
  | 'reminder'
  | 'patient_confirmed'
  | 'patient_declined';

export type DashboardNotification = {
  id: string;
  sourceKey: string;
  type: DashboardNotificationType;
  appointmentId: string;
  patientId?: string;
  patientName: string;
  date: string;
  time: string;
  title: string;
  description: string;
  href: string;
  isRead: boolean;
  isActive: boolean;
  createdAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;
};

function notificationTitle(type: DashboardNotificationType) {
  if (type === 'pending_appointment') return 'Turno pendiente';
  if (type === 'patient_confirmed') return 'Paciente confirmó asistencia';
  if (type === 'patient_declined') return 'Paciente no asistirá';
  return 'Recordatorio mañana';
}

function notificationDescription(appt: Record<string, any>, type: DashboardNotificationType) {
  if (type === 'pending_appointment') {
    return `${appt.patientName} solicitó un turno para ${appt.time} hs.`;
  }
  if (type === 'patient_confirmed') {
    return `${appt.patientName} confirmó la asistencia de las ${appt.time} hs.`;
  }
  if (type === 'patient_declined') {
    return `${appt.patientName} avisó que no asistirá al turno de las ${appt.time} hs.`;
  }
  return `${appt.patientName} tiene un turno mañana a las ${appt.time} hs.`;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapNotificationDocument(doc: Record<string, any>): DashboardNotification {
  return {
    id: doc._id?.toString() ?? doc.id,
    sourceKey: String(doc.sourceKey || ''),
    type: doc.type,
    appointmentId: String(doc.appointmentId || ''),
    patientId: doc.patientId ? String(doc.patientId) : undefined,
    patientName: String(doc.patientName || 'Paciente'),
    date: toIsoString(doc.date),
    time: String(doc.time || ''),
    title: String(doc.title || ''),
    description: String(doc.description || ''),
    href: String(doc.href || '/dashboard/calendario'),
    isRead: Boolean(doc.isRead),
    isActive: doc.isActive !== false,
    createdAt: toIsoString(doc.createdAt),
    readAt: doc.readAt ? toIsoString(doc.readAt) : null,
    resolvedAt: doc.resolvedAt ? toIsoString(doc.resolvedAt) : null,
  };
}

export async function syncDashboardNotifications(db: Db, professionalId: string) {
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const historyWindowStart = addDays(now, -30);

  const pending = await db
    .collection('appointments')
    .find({
      professionalId,
      status: 'pending',
      date: { $gte: now },
    })
    .sort({ date: 1, time: 1 })
    .limit(50)
    .toArray();

  const tomorrowAppointments = await db
    .collection('appointments')
    .find({
      professionalId,
      status: 'confirmed',
      date: { $gte: startOfDay(tomorrow), $lte: endOfDay(tomorrow) },
    })
    .sort({ time: 1 })
    .limit(50)
    .toArray();

  const patientResponses = await db
    .collection('appointments')
    .find({
      professionalId,
      patientResponsePendingNotification: true,
      patientResponse: { $in: ['confirmed', 'declined'] },
    })
    .sort({ patientRespondedAt: -1, updatedAt: -1 })
    .limit(50)
    .toArray();

  // Backfill de historial: respuestas ya notificadas en los ultimos 30 dias.
  const recentPatientResponses = await db
    .collection('appointments')
    .find({
      professionalId,
      patientResponse: { $in: ['confirmed', 'declined'] },
      patientRespondedAt: { $gte: historyWindowStart.toISOString() },
    })
    .sort({ patientRespondedAt: -1, updatedAt: -1 })
    .limit(100)
    .toArray();

  const pendingResponseIds = new Set(patientResponses.map((appt) => appt._id?.toString()));
  const historicalOnlyResponses = recentPatientResponses.filter(
    (appt) => !pendingResponseIds.has(appt._id?.toString())
  );

  const candidates = [
    ...patientResponses.map((appt) => ({
      sourceKey: `patient-response-${appt._id?.toString()}`,
      type: appt.patientResponse === 'confirmed' ? 'patient_confirmed' as const : 'patient_declined' as const,
      appointmentId: appt._id?.toString(),
      patientId: appt.patientId,
      patientName: appt.patientName,
      date: appt.date,
      time: appt.time,
      href: `/dashboard/calendario?appointmentId=${appt._id?.toString()}`,
      shouldBeActive: true,
      defaultIsRead: false,
    })),
    ...historicalOnlyResponses.map((appt) => ({
      sourceKey: `patient-response-${appt._id?.toString()}`,
      type: appt.patientResponse === 'confirmed' ? 'patient_confirmed' as const : 'patient_declined' as const,
      appointmentId: appt._id?.toString(),
      patientId: appt.patientId,
      patientName: appt.patientName,
      date: appt.date,
      time: appt.time,
      href: `/dashboard/calendario?appointmentId=${appt._id?.toString()}`,
      shouldBeActive: false,
      defaultIsRead: true,
    })),
    ...pending.map((appt) => ({
      sourceKey: `pending-${appt._id?.toString()}`,
      type: 'pending_appointment' as const,
      appointmentId: appt._id?.toString(),
      patientId: appt.patientId,
      patientName: appt.patientName,
      date: appt.date,
      time: appt.time,
      href: `/dashboard/calendario?appointmentId=${appt._id?.toString()}`,
      shouldBeActive: true,
      defaultIsRead: false,
    })),
    ...tomorrowAppointments.map((appt) => ({
      sourceKey: `reminder-${appt._id?.toString()}`,
      type: 'reminder' as const,
      appointmentId: appt._id?.toString(),
      patientId: appt.patientId,
      patientName: appt.patientName,
      date: appt.date,
      time: appt.time,
      href: `/dashboard/recordatorios`,
      shouldBeActive: true,
      defaultIsRead: false,
    })),
  ];

  if (patientResponses.length > 0) {
    await db.collection('appointments').updateMany(
      { _id: { $in: patientResponses.map((appt) => appt._id) } },
      {
        $set: {
          patientResponsePendingNotification: false,
          patientResponseNotifiedAt: now.toISOString(),
        },
      }
    );
  }

  if (candidates.length > 0) {
    await db.collection('notifications').bulkWrite(
      candidates.map((candidate) => ({
        updateOne: {
          filter: { professionalId, sourceKey: candidate.sourceKey },
          update: {
            $set: {
              professionalId,
              sourceKey: candidate.sourceKey,
              type: candidate.type,
              appointmentId: candidate.appointmentId,
              patientId: candidate.patientId,
              patientName: candidate.patientName,
              date: candidate.date,
              time: candidate.time,
              title: notificationTitle(candidate.type),
              description: notificationDescription(candidate, candidate.type),
              href: candidate.href,
              isActive: candidate.shouldBeActive,
              resolvedAt: candidate.shouldBeActive ? null : now,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
              isRead: candidate.defaultIsRead,
              readAt: candidate.defaultIsRead ? now : null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  const activeKeys = candidates.map((candidate) => candidate.sourceKey);
  const inactiveFilter = activeKeys.length > 0
    ? { professionalId, sourceKey: { $nin: activeKeys }, isActive: true }
    : { professionalId, isActive: true };

  await db.collection('notifications').updateMany(
    inactiveFilter,
    {
      $set: {
        isActive: false,
        resolvedAt: now,
        updatedAt: now,
      },
    }
  );
}

async function ensureNotificationIndexes(db: Db) {
  if (notificationsIndexesReady) return;
  await db.collection('notifications').createIndex({ professionalId: 1, sourceKey: 1 }, { unique: true });
  await db.collection('notifications').createIndex({ professionalId: 1, isActive: 1, isRead: 1, updatedAt: -1 });
  notificationsIndexesReady = true;
}

async function syncDashboardNotificationsThrottled(db: Db, professionalId: string) {
  const now = Date.now();
  const lastSyncAt = lastSyncByProfessional.get(professionalId) || 0;
  if (now - lastSyncAt < NOTIFICATIONS_SYNC_TTL_MS) {
    return;
  }

  const currentInFlight = syncInFlightByProfessional.get(professionalId);
  if (currentInFlight) {
    await currentInFlight;
    return;
  }

  const syncPromise = syncDashboardNotifications(db, professionalId)
    .then(() => {
      lastSyncByProfessional.set(professionalId, Date.now());
    })
    .finally(() => {
      syncInFlightByProfessional.delete(professionalId);
    });

  syncInFlightByProfessional.set(professionalId, syncPromise);
  await syncPromise;
}

export async function getDashboardNotifications(db: Db, professionalId: string, options?: { includeAll?: boolean; limit?: number }) {
  await ensureNotificationIndexes(db);
  await syncDashboardNotificationsThrottled(db, professionalId);

  const includeAll = options?.includeAll ?? false;
  const limit = options?.limit ?? (includeAll ? 100 : 20);
  const query = includeAll
    ? { professionalId }
    : { professionalId, isActive: true, isRead: false };

  const notifications = await db
    .collection('notifications')
    .find(query)
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(limit)
    .toArray();

  const unreadCount = await db.collection('notifications').countDocuments({
    professionalId,
    isActive: true,
    isRead: false,
  });

  return {
    notifications: notifications.map(mapNotificationDocument),
    unreadCount,
  };
}