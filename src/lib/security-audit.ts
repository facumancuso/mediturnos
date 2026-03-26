import { getMongoDb } from '@/lib/mongodb';

type SecurityAuditEvent = {
  type: 'forbidden_access' | 'unauthorized_access';
  endpoint: string;
  method: string;
  actorUid?: string;
  actorEmail?: string;
  requestedProfessionalId?: string;
  reason: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

let auditIndexesReady = false;

function toPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }

  return request.headers.get('x-real-ip') || undefined;
}

async function ensureSecurityAuditIndexes() {
  if (auditIndexesReady) return;

  const db = await getMongoDb();
  const logs = db.collection('security_audit_logs');
  const alerts = db.collection('security_alerts');

  const ttlDays = toPositiveNumber(process.env.SECURITY_AUDIT_TTL_DAYS, 30);

  await logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
  await logs.createIndex({ type: 1, endpoint: 1, createdAt: -1 });
  await logs.createIndex({ actorUid: 1, createdAt: -1 });

  await alerts.createIndex({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
  await alerts.createIndex({ dedupeKey: 1 }, { unique: true });

  auditIndexesReady = true;
}

async function evaluateSecurityAlert(eventDoc: Record<string, unknown>) {
  const db = await getMongoDb();
  const logs = db.collection('security_audit_logs');
  const alerts = db.collection('security_alerts');

  const threshold = toPositiveNumber(process.env.SECURITY_ALERT_THRESHOLD, 10);
  const windowMinutes = toPositiveNumber(process.env.SECURITY_ALERT_WINDOW_MINUTES, 10);
  const now = Date.now();
  const fromDate = new Date(now - windowMinutes * 60 * 1000);

  const actorUid = typeof eventDoc.actorUid === 'string' ? eventDoc.actorUid : '';
  const ip = typeof eventDoc.ip === 'string' ? eventDoc.ip : '';
  const type = typeof eventDoc.type === 'string' ? eventDoc.type : 'unknown';
  const endpoint = typeof eventDoc.endpoint === 'string' ? eventDoc.endpoint : 'unknown';

  const actorSelector = actorUid ? { actorUid } : { ip };

  const count = await logs.countDocuments({
    type,
    endpoint,
    ...actorSelector,
    createdAt: { $gte: fromDate },
  });

  if (count < threshold) {
    return;
  }

  const bucketMs = windowMinutes * 60 * 1000;
  const bucketStart = new Date(Math.floor(now / bucketMs) * bucketMs);
  const dedupeKey = `${type}:${endpoint}:${actorUid || ip || 'unknown'}:${bucketStart.toISOString()}`;

  await alerts.updateOne(
    { dedupeKey },
    {
      $set: {
        dedupeKey,
        type,
        endpoint,
        actorUid: actorUid || null,
        ip: ip || null,
        count,
        windowMinutes,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function logSecurityAudit(request: Request, event: SecurityAuditEvent) {
  try {
    await ensureSecurityAuditIndexes();
    const db = await getMongoDb();

    const eventDoc = {
      ...event,
      ip: event.ip || getClientIp(request),
      userAgent: event.userAgent || request.headers.get('user-agent') || undefined,
      createdAt: new Date(),
    };

    await db.collection('security_audit_logs').insertOne(eventDoc);
    await evaluateSecurityAlert(eventDoc);
  } catch (error) {
    console.error('No se pudo guardar log de auditoría de seguridad:', error);
  }
}
