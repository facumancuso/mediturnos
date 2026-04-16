import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { requireRequestAuth } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

function mapDoc(doc: Record<string, any>) {
  return { ...doc, id: doc._id?.toString(), _id: undefined };
}

// PATCH /api/dashboard/medical-records/[id]
// Body: { notes }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireRequestAuth(request);
    const { id } = await params;

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!objectId) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = await request.json();
    const { notes } = body || {};

    const db = await getMongoDb();
    const record = await db.collection('medical_records').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 });
    }
    if (record.professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    await db.collection('medical_records').updateOne(
      { _id: objectId },
      { $set: { notes: notes ?? '', updatedAt: new Date() } }
    );

    const updated = await db.collection('medical_records').findOne({ _id: objectId });
    return NextResponse.json(mapDoc(updated!));
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error actualizando registro médico:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el registro.' }, { status: 500 });
  }
}

// DELETE /api/dashboard/medical-records/[id]?fileId=xxx
// If fileId provided: removes only that file from the record
// Otherwise: deletes the whole record
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireRequestAuth(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    const objectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!objectId) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const record = await db.collection('medical_records').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado.' }, { status: 404 });
    }
    if (record.professionalId !== authUser.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    if (fileId) {
      await db.collection('medical_records').updateOne(
        { _id: objectId },
        { $pull: { files: { id: fileId } }, $set: { updatedAt: new Date() } }
      );
      const updated = await db.collection('medical_records').findOne({ _id: objectId });
      return NextResponse.json(mapDoc(updated!));
    }

    await db.collection('medical_records').deleteOne({ _id: objectId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    console.error('Error eliminando registro médico:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el registro.' }, { status: 500 });
  }
}
