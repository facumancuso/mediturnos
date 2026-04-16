import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import { getApprovedReviewsForProfessional } from '@/lib/reviews';
import { PROFESSIONAL_BRAND_COVER_URL } from '@/lib/branding';

export const dynamic = 'force-dynamic';

const PROFILE_CACHE_TTL_MS = 60_000;
const profileCache = new Map<string, { expiresAt: number; payload: Record<string, any> }>();

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const cached = profileCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }

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
    }, {
      projection: {
        id: 1,
        userId: 1,
        name: 1,
        specialty: 1,
        address: 1,
        whatsappNumber: 1,
        photoURL: 1,
        coverImageUrl: 1,
        publicProfile: 1,
      },
    });

    if (!professional) {
      return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });
    }

    const mappedProfessional = mapProfessionalDocument(professional);
    const reviews = await getApprovedReviewsForProfessional(
      db,
      String(mappedProfessional.id || professional.userId || '')
    );

    const payload = {
      ...mappedProfessional,
      reviews,
    };

    profileCache.set(slug, {
      expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    if (isMongoUnavailable(error)) {
      console.warn(
        `MongoDB no disponible para /api/professionals/[slug]. slug=${(await params).slug}`
      );
      return NextResponse.json(
        { error: 'El directorio no esta disponible temporalmente.' },
        { status: 503 }
      );
    }

    console.error('Error obteniendo profesional por slug desde MongoDB:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el perfil profesional.' },
      { status: 500 }
    );
  }
}
