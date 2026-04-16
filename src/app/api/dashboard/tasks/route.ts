import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'completed';

function mapDocument(doc: Record<string, any>) {
  return {
    ...doc,
    id: doc._id?.toString() || doc.id,
    _id: undefined,
    dueAt: doc.dueAt ? new Date(doc.dueAt).toISOString() : null,
    remindAt: doc.remindAt ? new Date(doc.remindAt).toISOString() : null,
    completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parsePriority(value: unknown): TaskPriority {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function parseStatus(value: unknown): TaskStatus {
  if (value === 'completed' || value === 'pending') return value;
  return 'pending';
}

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:tasks:get',
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
    const tasks = await db
      .collection('tasks')
      .find({ professionalId: authUser.uid })
      .sort({ status: 1, dueAt: 1, createdAt: -1 })
      .limit(500)
      .toArray();

    return NextResponse.json(tasks.map(mapDocument));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error obteniendo tareas:', error);
    return NextResponse.json({ error: 'No se pudieron obtener las tareas.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:tasks:post',
      identifier: authUser.uid,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const dueAt = parseOptionalDate(body?.dueAt);
    const remindAt = parseOptionalDate(body?.remindAt);
    const priority = parsePriority(body?.priority);

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio.' }, { status: 400 });
    }

    const now = new Date();
    const task = {
      professionalId: authUser.uid,
      title,
      description,
      dueAt,
      remindAt,
      priority,
      status: 'pending' as TaskStatus,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getMongoDb();
    const result = await db.collection('tasks').insertOne(task);
    const saved = await db.collection('tasks').findOne({ _id: result.insertedId });

    return NextResponse.json(mapDocument(saved || task), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error creando tarea:', error);
    return NextResponse.json({ error: 'No se pudo crear la tarea.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:tasks:patch',
      identifier: authUser.uid,
      limit: 80,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID de tarea invalido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const existing = await db.collection('tasks').findOne({ _id: new ObjectId(id), professionalId: authUser.uid });
    if (!existing) {
      return NextResponse.json({ error: 'Tarea no encontrada.' }, { status: 404 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body?.title !== undefined) updates.title = String(body.title || '').trim();
    if (body?.description !== undefined) updates.description = String(body.description || '').trim();
    if (body?.priority !== undefined) updates.priority = parsePriority(body.priority);
    if (body?.status !== undefined) {
      updates.status = parseStatus(body.status);
      updates.completedAt = updates.status === 'completed' ? new Date() : null;
    }
    if (body?.dueAt !== undefined) updates.dueAt = parseOptionalDate(body.dueAt);
    if (body?.remindAt !== undefined) updates.remindAt = parseOptionalDate(body.remindAt);

    if (updates.title === '') {
      return NextResponse.json({ error: 'El titulo no puede estar vacio.' }, { status: 400 });
    }

    await db.collection('tasks').updateOne(
      { _id: new ObjectId(id), professionalId: authUser.uid },
      { $set: updates }
    );

    const updated = await db.collection('tasks').findOne({ _id: new ObjectId(id), professionalId: authUser.uid });
    return NextResponse.json(mapDocument(updated || existing));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error actualizando tarea:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la tarea.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'dashboard:tasks:delete',
      identifier: authUser.uid,
      limit: 80,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID de tarea invalido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const result = await db.collection('tasks').deleteOne({ _id: new ObjectId(id), professionalId: authUser.uid });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Tarea no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error eliminando tarea:', error);
    return NextResponse.json({ error: 'No se pudo eliminar la tarea.' }, { status: 500 });
  }
}