import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

const ALLOWED_STATUS = new Set(['paid', 'pending', 'overdue']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:payments:status:patch',
    identifier: 'superadmin-payments-status',
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
    const admin = await requireSuperAdminRequest(request);
    const { id } = await params;
    const body = await request.json();
    const nextStatus = String(body?.status || '').toLowerCase();

    if (!ALLOWED_STATUS.has(nextStatus)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const payments = db.collection('payments');

    const filter: Record<string, any> = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { _id: id };

    const current = await payments.findOne(filter);
    if (!current) {
      return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });
    }

    const now = new Date();
    await payments.updateOne(
      { _id: current._id },
      {
        $set: {
          status: nextStatus,
          updatedAt: now,
          reviewedBy: admin.uid,
          ...(nextStatus === 'paid' ? { paidAt: now } : {}),
        },
      }
    );

    const updated = await payments.findOne({ _id: current._id });

    return NextResponse.json({
      ok: true,
      id: updated?._id?.toString(),
      status: updated?.status,
      paidAt: updated?.paidAt || null,
    });
  } catch (error) {
    console.error('[SuperAdmin Payments Status PATCH Error]', error);

    if (error instanceof Error && error.message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'No se pudo actualizar el estado del pago.' }, { status: 500 });
  }
}
