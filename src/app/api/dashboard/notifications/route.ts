import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getDashboardNotifications } from '@/lib/dashboard-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);

    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:notifications:get',
      identifier: authUser.uid,
      limit: 120,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const db = await getMongoDb();
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('scope') === 'all';
    const { notifications, unreadCount } = await getDashboardNotifications(db, authUser.uid, {
      includeAll,
      limit: includeAll ? 100 : 20,
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error obteniendo notificaciones:', error);
    return NextResponse.json({ error: 'No se pudieron obtener las notificaciones.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);

    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:notifications:patch',
      identifier: authUser.uid,
      limit: 120,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : '';
    const markAllRead = body?.markAllRead === true;
    const db = await getMongoDb();
    const now = new Date();

    if (markAllRead) {
      await db.collection('notifications').updateMany(
        { professionalId: authUser.uid, isRead: false },
        { $set: { isRead: true, readAt: now, updatedAt: now } }
      );
    } else if (notificationId) {
      const objectId = ObjectId.isValid(notificationId) ? new ObjectId(notificationId) : null;
      if (!objectId) {
        return NextResponse.json({ error: 'notificationId inválido.' }, { status: 400 });
      }

      await db.collection('notifications').updateOne(
        { _id: objectId, professionalId: authUser.uid },
        { $set: { isRead: true, readAt: now, updatedAt: now } }
      );
    } else {
      return NextResponse.json({ error: 'notificationId o markAllRead es obligatorio.' }, { status: 400 });
    }

    const { notifications, unreadCount } = await getDashboardNotifications(db, authUser.uid, { includeAll: false, limit: 20 });
    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error actualizando notificaciones:', error);
    return NextResponse.json({ error: 'No se pudieron actualizar las notificaciones.' }, { status: 500 });
  }
}
