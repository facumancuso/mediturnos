import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getMongoDb } from '@/lib/mongodb';

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
    
    // Get all payments for this professional
    const payments = await db
      .collection('payments')
      .find({ professionalId: authUser.uid })
      .sort({ date: -1 })
      .limit(100)
      .toArray();

    // Map to response format
    const mapped = payments.map((p: any) => ({
      id: p._id?.toString() || '',
      date: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
      amount: p.amount || 0,
      status: p.status || 'Pendiente',
      plan: p.plan || 'Profesional',
      description: p.description || '',
      reference: p.reference || '',
      method: p.method || 'Stripe',
      invoiceNumber: p.invoiceNumber || '',
    }));

    return NextResponse.json(
      {
        payments: mapped,
        total: payments.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Payments API Error]', error);

    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Error retrieving payments.' },
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
    const { amount, plan, description, method } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Monto inválido.' },
        { status: 400 }
      );
    }

    const db = await getMongoDb();

    const paymentDoc = {
      professionalId: authUser.uid,
      date: new Date(),
      amount,
      status: 'Pendiente',
      plan,
      description,
      method: method || 'Stripe',
      invoiceNumber: `INV-${Date.now()}`,
      reference: '',
      createdAt: new Date(),
      updatedAt: new Date(),
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
      { error: 'Error creating payment.' },
      { status: 500 }
    );
  }
}
