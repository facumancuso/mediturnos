import { NextResponse } from 'next/server';

import { getMongoDb } from '@/lib/mongodb';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getApprovedReviewsForProfessional, isRatingRequestExpired, syncProfessionalReviewStats } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

function buildUnavailableResponse(status: number, error: string, state: 'expired' | 'used' | 'invalid') {
  return NextResponse.json({ error, state }, { status });
}

function mapRatingContext(appointment: Record<string, any>, professional?: Record<string, any> | null) {
  return {
    state: 'available' as const,
    appointment: {
      id: appointment._id?.toString(),
      patientName: appointment.patientName || 'Paciente',
      date: appointment.date,
      time: appointment.time,
      type: appointment.type,
    },
    professional: {
      id: professional?.id || professional?.userId || appointment.professionalId,
      name: professional?.name || 'Profesional',
      slug: professional?.publicProfile?.slug || null,
      specialty: professional?.specialty || '',
    },
    expiresAt: appointment.ratingRequestTokenExpiresAt || null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'patient:rating:get',
      limit: 40,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { token } = await params;
    if (!token) {
      return buildUnavailableResponse(400, 'Token de calificación inválido.', 'invalid');
    }

    const db = await getMongoDb();
    const appointment = await db.collection('appointments').findOne({ ratingRequestToken: token });

    if (!appointment) {
      return buildUnavailableResponse(404, 'Este enlace de calificación no es válido.', 'invalid');
    }

    if (appointment.reviewSubmittedAt || appointment.reviewId || appointment.ratingRequestUsedAt) {
      return buildUnavailableResponse(409, 'Esta atención ya fue calificada.', 'used');
    }

    if (appointment.status !== 'completed') {
      return buildUnavailableResponse(409, 'La calificación solo está disponible para turnos completados.', 'invalid');
    }

    if (isRatingRequestExpired(appointment.ratingRequestTokenExpiresAt)) {
      return buildUnavailableResponse(410, 'Este enlace de calificación venció.', 'expired');
    }

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: appointment.professionalId }, { userId: appointment.professionalId }] },
      { projection: { id: 1, userId: 1, name: 1, specialty: 1, 'publicProfile.slug': 1 } }
    );

    return NextResponse.json(mapRatingContext(appointment, professional));
  } catch (error) {
    console.error('Error obteniendo contexto de calificación:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar la calificación.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const rateLimit = await enforceRateLimit({
      request,
      keyPrefix: 'patient:rating:post',
      limit: 12,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { token } = await params;
    if (!token) {
      return buildUnavailableResponse(400, 'Token de calificación inválido.', 'invalid');
    }

    const body = await request.json();
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'La calificación debe ser un número entre 1 y 5.' }, { status: 400 });
    }

    if (comment.length < 10) {
      return NextResponse.json({ error: 'El comentario debe tener al menos 10 caracteres.' }, { status: 400 });
    }

    const db = await getMongoDb();
    await db.collection('reviews').createIndex({ appointmentId: 1 }, { unique: true });

    const appointment = await db.collection('appointments').findOne({ ratingRequestToken: token });

    if (!appointment) {
      return buildUnavailableResponse(404, 'Este enlace de calificación no es válido.', 'invalid');
    }

    if (appointment.reviewSubmittedAt || appointment.reviewId || appointment.ratingRequestUsedAt) {
      return buildUnavailableResponse(409, 'Esta atención ya fue calificada.', 'used');
    }

    if (appointment.status !== 'completed') {
      return buildUnavailableResponse(409, 'La calificación solo está disponible para turnos completados.', 'invalid');
    }

    if (isRatingRequestExpired(appointment.ratingRequestTokenExpiresAt)) {
      return buildUnavailableResponse(410, 'Este enlace de calificación venció.', 'expired');
    }

    const professional = await db.collection('professionals').findOne(
      { $or: [{ id: appointment.professionalId }, { userId: appointment.professionalId }] },
      { projection: { id: 1, userId: 1, name: 1, specialty: 1, 'publicProfile.slug': 1 } }
    );

    const now = new Date();
    let reviewId = '';

    try {
      const insertResult = await db.collection('reviews').insertOne({
        appointmentId: appointment._id?.toString(),
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        patientName: appointment.patientName || 'Paciente',
        authorName: appointment.patientName || 'Paciente',
        rating,
        comment,
        status: 'approved',
        createdAt: now,
        updatedAt: now,
      });
      reviewId = insertResult.insertedId.toString();
    } catch (error) {
      const duplicateKeyError = error as { code?: number };
      if (duplicateKeyError?.code === 11000) {
        return buildUnavailableResponse(409, 'Esta atención ya fue calificada.', 'used');
      }
      throw error;
    }

    await db.collection('appointments').updateOne(
      { _id: appointment._id },
      {
        $set: {
          reviewId,
          reviewSubmittedAt: now.toISOString(),
          ratingRequestUsedAt: now.toISOString(),
          updatedAt: now,
        },
        $unset: {
          ratingRequestToken: '',
        },
      }
    );

    const stats = await syncProfessionalReviewStats(db, appointment.professionalId);
    const reviews = await getApprovedReviewsForProfessional(db, appointment.professionalId);

    return NextResponse.json({
      success: true,
      reviewId,
      stats,
      reviews,
      context: mapRatingContext(appointment, professional),
    });
  } catch (error) {
    console.error('Error guardando calificación pública:', error);
    return NextResponse.json(
      { error: 'No se pudo guardar la calificación.' },
      { status: 500 }
    );
  }
}