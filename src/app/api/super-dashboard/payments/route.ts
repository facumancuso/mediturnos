import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSuperAdminRequest } from '@/lib/super-admin-request';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  const rateLimit = await enforceRateLimit({
    request,
    keyPrefix: 'super-dashboard:payments:get',
    identifier: 'superadmin-payments',
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
    await requireSuperAdminRequest(request);

    const searchParams = request.nextUrl.searchParams;
    const professionalId = searchParams.get('professionalId') || '';

    const db = await getMongoDb();
    const paymentsCollection = db.collection('payments');

    const filter = professionalId ? { professionalId } : {};

    const payments = await paymentsCollection
      .find(filter)
      .sort({ period: -1, dueDate: -1 })
      .limit(200)
      .toArray();

    const professionalIds = [...new Set(payments.map((payment: any) => payment.professionalId).filter(Boolean))];

    const professionals = await db
      .collection('professionals')
      .find({
        $or: [{ id: { $in: professionalIds } }, { userId: { $in: professionalIds } }],
      })
      .toArray();

    const professionalById = new Map<string, any>();
    for (const professional of professionals) {
      if (professional.id) professionalById.set(String(professional.id), professional);
      if (professional.userId) professionalById.set(String(professional.userId), professional);
    }

    const mapped = payments.map((payment: any) => {
      const professional = professionalById.get(String(payment.professionalId)) || null;

      return {
        id: payment._id?.toString() || '',
        professionalId: payment.professionalId,
        professionalName: professional?.name || 'Profesional',
        professionalEmail: professional?.email || '',
        period: payment.period || '',
        dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString() : null,
        amount: payment.amount || 0,
        paymentMethod: payment.paymentMethod || '',
        paymentReference: payment.paymentReference || '',
        status: payment.status || 'pending',
        receipt: payment.receipt || null,
        submittedAt: payment.submittedAt ? new Date(payment.submittedAt).toISOString() : null,
        paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : null,
      };
    });

    return NextResponse.json({ payments: mapped });
  } catch (error) {
    console.error('[SuperAdmin Payments GET Error]', error);

    if (error instanceof Error && error.message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'No se pudieron cargar los pagos.' }, { status: 500 });
  }
}
