import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';

type SecurityLogDoc = {
  type?: string;
  endpoint?: string;
  method?: string;
  actorUid?: string;
  actorEmail?: string;
  requestedProfessionalId?: string;
  reason?: string;
  ip?: string;
  userAgent?: string;
  createdAt?: Date;
};

function mapLog(doc: SecurityLogDoc & { _id?: { toString?: () => string } }) {
  return {
    id: doc._id?.toString?.() || '',
    type: doc.type || 'unknown',
    endpoint: doc.endpoint || '',
    method: doc.method || '',
    actorUid: doc.actorUid || '',
    actorEmail: doc.actorEmail || '',
    requestedProfessionalId: doc.requestedProfessionalId || '',
    reason: doc.reason || '',
    ip: doc.ip || '',
    userAgent: doc.userAgent || '',
    createdAt: doc.createdAt || null,
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await requireSuperAdminRequest(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'super:security-logs:get',
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
    const parsedLimit = Number(searchParams.get('limit') || '100');
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
    const type = (searchParams.get('type') || '').trim();
    const endpoint = (searchParams.get('endpoint') || '').trim();
    const actorUid = (searchParams.get('actorUid') || '').trim();
    const sinceHoursRaw = Number(searchParams.get('sinceHours') || '');

    const query: Record<string, unknown> = {};
    if (type) query.type = type;
    if (endpoint) query.endpoint = endpoint;
    if (actorUid) query.actorUid = actorUid;
    if (Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0) {
      query.createdAt = { $gte: new Date(Date.now() - sinceHoursRaw * 60 * 60 * 1000) };
    }

    const db = await getMongoDb();
    const logs = await db
      .collection('security_audit_logs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(logs.map(mapLog));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('FORBIDDEN_SUPERADMIN') ||
        error.message.includes('UNAUTHORIZED') ||
        error.message.includes('Token de autorización'))
    ) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    console.error('Error consultando logs de seguridad:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los logs de seguridad.' }, { status: 500 });
  }
}
