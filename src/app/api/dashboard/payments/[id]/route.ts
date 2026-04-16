import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

type PaymentStatus = 'pending' | 'submitted' | 'paid' | 'overdue';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'dashboard:payments:patch',
    identifier: 'professional-payment-update',
    limit: 40,
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
    const authUser = await requireRequestAuth(request);
    const { id } = await params;
    const body = await request.json();

    const action = String(body?.action || 'submit');
    const paymentMethod = String(body?.paymentMethod || '').trim();
    const paymentReference = String(body?.paymentReference || '').trim();

    if (action !== 'submit') {
      return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Debes indicar la forma de pago.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const payments = db.collection('payments');

    const match: Record<string, any> = {
      professionalId: authUser.uid,
      _id: ObjectId.isValid(id) ? new ObjectId(id) : id,
    };

    const current = await payments.findOne(match);
    if (!current) {
      return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 });
    }

    if (current.status === 'paid') {
      return NextResponse.json({ error: 'Ese pago ya está confirmado.' }, { status: 400 });
    }

    const now = new Date();

    await payments.updateOne(
      { _id: current._id },
      {
        $set: {
          status: 'submitted' as PaymentStatus,
          paymentMethod,
          paymentReference,
          receipt: null,
          submittedAt: now,
          updatedAt: now,
        },
      }
    );

    const updated = await payments.findOne({ _id: current._id });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated?._id?.toString(),
        status: updated?.status,
        submittedAt: updated?.submittedAt,
      },
    });
  } catch (error) {
    console.error('[Payments PATCH Error]', error);

    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'No se pudo actualizar el pago.' },
      { status: 500 }
    );
  }
}
