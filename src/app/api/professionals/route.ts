import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function mapProfessionalDocument(doc: Record<string, any>) {
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

export async function GET() {
  try {
    const db = await getMongoDb();

    // Obtener todos los profesionales con perfil público habilitado
    const professionals = await db
      .collection('professionals')
      .find({
        $and: [
          {
            $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: { $ne: true } }],
          },
          {
            $or: [
              { 'publicProfile.enabled': true },
              { 'publicProfile.enabled': { $exists: false } },
            ],
          },
        ],
      })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json(professionals.map(mapProfessionalDocument));
  } catch (error) {
    console.error('Error obteniendo profesionales desde MongoDB:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los profesionales.' },
      { status: 500 }
    );
  }
}
