import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { buildICalContent } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const objectId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objectId) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }

  const db = await getMongoDb();
  const appt = await db.collection('appointments').findOne({ _id: objectId });

  if (!appt) {
    return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });
  }

  const professional = await db.collection('professionals').findOne({
    $or: [{ id: appt.professionalId }, { userId: appt.professionalId }],
  });

  const startDate = new Date(appt.date);
  const [hours, minutes] = (appt.time as string).split(':').map(Number);
  startDate.setHours(hours, minutes, 0, 0);

  const updatedAtDate = appt.updatedAt ? new Date(appt.updatedAt) : new Date();
  const safeUpdatedAt = Number.isNaN(updatedAtDate.getTime()) ? new Date() : updatedAtDate;
  const sequence = Math.floor(safeUpdatedAt.getTime() / 1000);

  const ical = buildICalContent({
    title: `Turno con ${professional?.name || 'el profesional'}`,
    description: `Paciente: ${appt.patientName}`,
    location: professional?.address || '',
    startDate,
    durationMinutes: appt.duration || 30,
    uid: `appointment-${id}@mediturnos`,
    sequence,
    lastModified: safeUpdatedAt,
  });

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="turno-${id}.ics"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
