import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getMongoDb } from '@/lib/mongodb';

type PaymentStatus = 'pending' | 'submitted' | 'paid' | 'overdue';

const DEFAULT_MONTHLY_AMOUNT = 25000;
/** Día del mes en que vence el pago de ese período */
const PAYMENT_DUE_DAY = 5;
/** Día del mes en que se activa el próximo período */
const ACTIVATION_DAY = 25;

function buildDueDate(period: string): Date {
  return new Date(`${period}-${String(PAYMENT_DUE_DAY).padStart(2, '0')}T23:59:59.999Z`);
}

/**
 * Último período visible hoy.
 * Si hoy >= día 25 → el mes siguiente ya está activo.
 */
function getLastVisiblePeriod(now: Date): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const day = now.getDate();

  if (day >= ACTIVATION_DAY) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Período de inicio según la fecha de registro del profesional. */
function getStartPeriod(createdAt: Date): string {
  return `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
}

/** Lista de períodos entre startPeriod y endPeriod inclusive (máximo 60). */
function getPeriodsBetween(startPeriod: string, endPeriod: string): string[] {
  const [sy, sm] = startPeriod.split('-').map(Number);
  const [ey, em] = endPeriod.split('-').map(Number);

  const periods: string[] = [];
  let year = sy;
  let month = sm;
  let limit = 60; // máximo 5 años de seguridad

  while ((year < ey || (year === ey && month <= em)) && limit-- > 0) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return periods;
}

function mapStatusForUi(status: PaymentStatus) {
  if (status === 'paid') return 'Pago recibido';
  if (status === 'submitted') return 'Pago enviado';
  if (status === 'overdue') return 'Vencido';
  return 'Falta pagar';
}

function mapMethodForUi(method?: string) {
  if (!method) return '-';
  return method;
}

async function getRegistrationDate(uid: string, fallback: Date) {
  try {
    const auth = getAuth(getFirebaseAdminApp());
    const userRecord = await auth.getUser(uid);
    const creationTime = userRecord.metadata.creationTime;
    if (creationTime) {
      const parsed = new Date(creationTime);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('[Payments] No se pudo leer creationTime de Firebase Auth', error);
  }
  return fallback;
}

async function ensureMonthlyPayments(db: Awaited<ReturnType<typeof getMongoDb>>, professionalId: string) {
  const professionals = db.collection('professionals');
  const payments = db.collection('payments');

  const professional = await professionals.findOne({
    $or: [{ id: professionalId }, { userId: professionalId }],
  });

  if (!professional) return;

  // ── Monto mensual desde suscripción ──────────────────────────────
  const subscription = (professional.subscription && typeof professional.subscription === 'string')
    ? (() => {
        try {
          return JSON.parse(professional.subscription) as { monthlyAmount?: number };
        } catch {
          return {} as { monthlyAmount?: number };
        }
      })()
    : {};

  const monthlyAmount =
    typeof subscription.monthlyAmount === 'number' && Number.isFinite(subscription.monthlyAmount)
      ? subscription.monthlyAmount
      : DEFAULT_MONTHLY_AMOUNT;

  const now = new Date();

  // Fecha de respaldo desde Mongo (si Firebase falla)
  const rawCreatedAt = professional.createdAt;
  const mongoCreatedAt =
    rawCreatedAt instanceof Date
      ? rawCreatedAt
      : rawCreatedAt
      ? new Date(rawCreatedAt)
      : now;

  // Fecha real de alta desde Firebase Auth
  const registrationDate = await getRegistrationDate(
    professionalId,
    Number.isNaN(mongoCreatedAt.getTime()) ? now : mongoCreatedAt
  );

  const startPeriod = getStartPeriod(registrationDate);
  const lastVisiblePeriod = getLastVisiblePeriod(now);

  // Si se registró en el futuro (caso imposible pero seguro), no generar nada
  if (startPeriod > lastVisiblePeriod) return;

  const periods = getPeriodsBetween(startPeriod, lastVisiblePeriod);
  if (periods.length === 0) return;

  const operations = periods.map((period) => {
    const paymentDoc = {
      professionalId,
      period,
      dueDate: buildDueDate(period),
      amount: monthlyAmount,
      paymentMethod: '',
      paymentReference: '',
      status: 'pending' as PaymentStatus,
      receipt: null,
      submittedAt: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return {
      updateOne: {
        filter: { professionalId, period },
        update: {
          $setOnInsert: paymentDoc,
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await payments.bulkWrite(operations, { ordered: false });
  }

  // Limpiar deudas previas a la fecha de alta real que hayan quedado de una lógica vieja.
  await payments.deleteMany({
    professionalId,
    period: { $lt: startPeriod },
    receipt: null,
    submittedAt: null,
  });

  // Eliminar pagos futuros aún pendientes que se hayan colado antes de este fix.
  await payments.deleteMany({
    professionalId,
    period: { $gt: lastVisiblePeriod },
    status: 'pending',
    receipt: null,
    submittedAt: null,
  });

  // Marcar como vencidos los pending cuyo dueDate ya pasó
  await payments.updateMany(
    {
      professionalId,
      status: 'pending',
      dueDate: { $lt: now },
    },
    {
      $set: {
        status: 'overdue',
        updatedAt: now,
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await requireRequestAuth(request);

    // Rate limiting
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:payments:get',
      identifier: authUser.uid,
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

    const db = await getMongoDb();
    await ensureMonthlyPayments(db, authUser.uid);

    const now = new Date();
    const lastVisiblePeriod = getLastVisiblePeriod(now);

    const professionals = db.collection('professionals');
    const professional = await professionals.findOne({
      $or: [{ id: authUser.uid }, { userId: authUser.uid }],
    });

    const fallbackCreatedAtRaw = professional?.createdAt;
    const fallbackCreatedAt =
      fallbackCreatedAtRaw instanceof Date
        ? fallbackCreatedAtRaw
        : fallbackCreatedAtRaw
        ? new Date(fallbackCreatedAtRaw)
        : now;

    const registrationDate = await getRegistrationDate(
      authUser.uid,
      Number.isNaN(fallbackCreatedAt.getTime()) ? now : fallbackCreatedAt
    );
    const startPeriod = getStartPeriod(registrationDate);

    // Get all payments for this professional (sorted cronológicamente: más nuevo primero)
    const payments = await db
      .collection('payments')
      .find({ professionalId: authUser.uid })
      .sort({ period: -1 })
      .limit(100)
      .toArray();

    // Map to response format
    const mapped = payments.map((p: any) => ({
      id: p._id?.toString() || '',
      period: p.period || '',
      dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : new Date().toISOString(),
      amount: p.amount || 0,
      status: mapStatusForUi((p.status || 'pending') as PaymentStatus),
      statusCode: (p.status || 'pending') as PaymentStatus,
      reference: p.paymentReference || '',
      method: mapMethodForUi(p.paymentMethod),
      submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      receipt: p.receipt || null,
    }));

    return NextResponse.json(
      {
        payments: mapped,
        total: mapped.length,
        startPeriod,
        lastVisiblePeriod,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Payments API Error]', error);

    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'No se pudieron obtener los pagos.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireRequestAuth(request);

    // Rate limiting
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:payments:post',
      identifier: authUser.uid,
      limit: 30,
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

    const body = await request.json();
    const { amount, plan, description, method, period } = body;

    if (!amount || amount <= 0 || !period) {
      return NextResponse.json(
        { error: 'Monto o período inválido.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();

    const now = new Date();
    const paymentDoc = {
      professionalId: authUser.uid,
      period,
      dueDate: buildDueDate(period),
      amount,
      status: 'pending' as PaymentStatus,
      plan,
      description,
      paymentMethod: method || '',
      invoiceNumber: `INV-${Date.now()}`,
      paymentReference: '',
      receipt: null,
      submittedAt: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('payments').insertOne(paymentDoc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        ...paymentDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Payments Create Error]', error);

    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'No se pudo crear el pago.' },
      { status: 500 }
    );
  }
}
