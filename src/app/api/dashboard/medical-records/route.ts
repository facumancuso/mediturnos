import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { MedicalFile } from '@/lib/firebase-storage';

export const dynamic = 'force-dynamic';

function mapDoc(doc: Record<string, any>) {
  return { ...doc, id: doc._id?.toString(), _id: undefined };
}

// GET /api/dashboard/medical-records?professionalId=&patientId=
export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const patientId = searchParams.get('patientId');

    if (!professionalId || !patientId) {
      return NextResponse.json({ error: 'professionalId y patientId son obligatorios.' }, { status: 400 });
    }
    if (professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const records = await db
      .collection('medical_records')
      .find({ professionalId, patientId })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(records.map(mapDoc));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error obteniendo historial médico:', error);
    return NextResponse.json({ error: 'No se pudo obtener el historial médico.' }, { status: 500 });
  }
}

// POST /api/dashboard/medical-records
// Body: { professionalId, patientId, appointmentId, notes?, file?: MedicalFile }
export async function POST(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);

    const rl = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:medical-records:post',
      identifier: authUser.uid,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { professionalId, patientId, appointmentId, notes, file } = body || {};

    if (!professionalId || !patientId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
    }
    if (professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const db = await getMongoDb();
    const now = new Date();

    const query: Record<string, any> = { professionalId, patientId };
    if (appointmentId) query.appointmentId = appointmentId;

    const existing = await db.collection('medical_records').findOne(query);

    if (existing) {
      const setFields: Record<string, any> = { updatedAt: now };
      if (notes !== undefined) setFields.notes = notes;

      const updateOp: Record<string, any> = { $set: setFields };
      if (file) updateOp.$push = { files: file as MedicalFile };

      await db.collection('medical_records').updateOne({ _id: existing._id }, updateOp);

      const updated = await db.collection('medical_records').findOne({ _id: existing._id });
      return NextResponse.json(mapDoc(updated!));
    }

    // Create new record
    const newRecord = {
      professionalId,
      patientId,
      appointmentId: appointmentId || null,
      notes: notes || '',
      files: file ? [file] : [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('medical_records').insertOne(newRecord);
    const saved = await db.collection('medical_records').findOne({ _id: result.insertedId });
    return NextResponse.json(mapDoc(saved!), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error guardando historial médico:', error);
    return NextResponse.json({ error: 'No se pudo guardar el historial médico.' }, { status: 500 });
  }
}
