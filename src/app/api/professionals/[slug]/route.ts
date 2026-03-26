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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const db = await getMongoDb();

    const professional = await db.collection('professionals').findOne({
      $and: [
        {
          $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: { $ne: true } }],
        },
        {
          'publicProfile.slug': slug,
          'publicProfile.enabled': true,
        },
      ],
    });

    if (!professional) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(mapProfessionalDocument(professional));
  } catch (error) {
    console.error('Error obteniendo profesional por slug desde MongoDB:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el perfil profesional.' },
      { status: 500 }
    );
  }
}
