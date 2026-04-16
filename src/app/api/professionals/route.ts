import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { PROFESSIONAL_BRAND_COVER_URL } from '@/lib/branding';

export const dynamic = 'force-dynamic';

const DIRECTORY_CACHE_TTL_MS = 60_000;

let cachedProfessionals: Array<Record<string, unknown>> | null = null;
let cachedAt = 0;

function isMongoUnavailable(error: unknown): boolean {
  const errorWithCause = error as {
    name?: string;
    code?: string;
    cause?: { code?: string; cause?: { code?: string } };
  };

  const name = errorWithCause?.name || '';
  const code =
    errorWithCause?.code ||
    errorWithCause?.cause?.code ||
    errorWithCause?.cause?.cause?.code ||
    '';

  return (
    code === 'ECONNREFUSED' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError'
  );
}

function mapProfessionalDocument(doc: Record<string, any>) {
  return {
    ...doc,
    coverImageUrl: PROFESSIONAL_BRAND_COVER_URL,
    id: doc.id || doc._id?.toString(),
    _id: undefined,
  };
}

export async function GET() {
  try {
    if (cachedProfessionals && Date.now() - cachedAt < DIRECTORY_CACHE_TTL_MS) {
      return NextResponse.json(cachedProfessionals, {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }

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
      .project({
        _id: 1,
        id: 1,
        name: 1,
        specialty: 1,
        address: 1,
        photoURL: 1,
        coverImageUrl: 1,
        publicProfile: 1,
      })
      .sort({ name: 1 })
      .toArray();

    const mapped = professionals.map(mapProfessionalDocument);
    cachedProfessionals = mapped;
    cachedAt = Date.now();

    return NextResponse.json(mapped, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    if (isMongoUnavailable(error)) {
      console.warn(
        'MongoDB no disponible para /api/professionals. Se devuelve lista vacia temporalmente.'
      );
      return NextResponse.json([]);
    }

    console.error('Error obteniendo profesionales desde MongoDB:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los profesionales.' },
      { status: 500 }
    );
  }
}
