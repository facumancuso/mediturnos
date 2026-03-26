import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:alerts:get',
    identifier: 'superadmin-alerts',
    limit: 120,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    // Validate superadmin
    await requireSuperAdminRequest(request);

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'active'; // active, resolved, acknowledged
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, severity
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await getMongoDb();
    const alertsCollection = db.collection('security_alerts');

    // Build filter
    const filter: any = {};
    if (status !== 'all') {
      filter.status = status;
    }

    // Get total count
    const total = await alertsCollection.countDocuments(filter);

    // Get alerts
    const alerts = await alertsCollection
      .find(filter)
      .sort(sortBy === 'severity' ? { severity: -1, createdAt: -1 } : { createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Map and format
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert._id?.toString() || '',
      type: alert.type,
      endpoint: alert.endpoint,
      actorUid: alert.actorUid,
      eventCount: alert.eventCount || 0,
      threshold: alert.threshold || 10,
      windowMinutes: alert.windowMinutes || 10,
      status: alert.status || 'active',
      severity: calculateSeverity(alert.eventCount || 0, alert.threshold || 10),
      createdAt: alert.createdAt ? new Date(alert.createdAt).toISOString() : new Date().toISOString(),
      acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toISOString() : null,
      resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : null,
      notes: alert.notes || '',
    }));

    return NextResponse.json(
      {
        alerts: formattedAlerts,
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SuperAdmin Alerts API Error]', error);

    if (error instanceof Error && error.message.includes('Superadmin')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Error retrieving alerts.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Rate limiting
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:alerts:patch',
    identifier: 'superadmin-alerts',
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    // Validate superadmin
    const auth = await requireSuperAdminRequest(request);

    const { alertId, status, notes } = await request.json();

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId is required.' },
        { status: 400 }
      );
    }

    if (!['active', 'acknowledged', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const alertsCollection = db.collection('security_alerts');

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'acknowledged') {
      updateData.acknowledgedAt = new Date();
      updateData.acknowledgedBy = auth.uid;
    } else if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = auth.uid;
    }

    if (notes) {
      updateData.notes = notes;
    }

    const result = await alertsCollection.findOneAndUpdate(
      { _id: new (await import('mongodb')).ObjectId(alertId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result?.value) {
      return NextResponse.json(
        { error: 'Alert not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Alert updated successfully.',
        alert: result?.value,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SuperAdmin Alerts Update Error]', error);

    if (error instanceof Error && error.message.includes('Superadmin')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Error updating alert.' },
      { status: 500 }
    );
  }
}

function calculateSeverity(eventCount: number, threshold: number): 'critical' | 'high' | 'medium' {
  const ratio = eventCount / threshold;
  if (ratio >= 3) return 'critical';
  if (ratio >= 1.5) return 'high';
  return 'medium';
}
