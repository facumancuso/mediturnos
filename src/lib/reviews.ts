import { randomBytes } from 'crypto';
import type { Db } from 'mongodb';

import type { Review } from '@/types';

export const RATING_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export function createRatingRequestToken() {
  return randomBytes(24).toString('hex');
}

export function getRatingRequestExpiryDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + RATING_LINK_TTL_MS);
}

export function isRatingRequestExpired(expiresAt?: string | Date | null, now = new Date()) {
  if (!expiresAt) {
    return true;
  }

  const parsed = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.getTime() <= now.getTime();
}

function normalizeReviewDocument(doc: Record<string, any>): Review {
  const createdAt = doc.createdAt instanceof Date
    ? doc.createdAt.toISOString()
    : typeof doc.createdAt === 'string'
      ? doc.createdAt
      : new Date().toISOString();

  return {
    id: doc._id?.toString() ?? doc.id,
    appointmentId: doc.appointmentId,
    professionalId: doc.professionalId,
    authorName: doc.authorName,
    rating: Number(doc.rating) || 0,
    comment: String(doc.comment || ''),
    createdAt,
    status: doc.status === 'pending' ? 'pending' : 'approved',
  };
}

export async function getApprovedReviewsForProfessional(db: Db, professionalId: string) {
  const reviews = await db
    .collection('reviews')
    .find({ professionalId, status: 'approved' })
    .sort({ createdAt: -1 })
    .toArray();

  return reviews.map(normalizeReviewDocument);
}

export async function syncProfessionalReviewStats(db: Db, professionalId: string) {
  const [stats] = await db
    .collection('reviews')
    .aggregate([
      { $match: { professionalId, status: 'approved' } },
      {
        $group: {
          _id: '$professionalId',
          reviewCount: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ])
    .toArray();

  const reviewCount = Number(stats?.reviewCount) || 0;
  const averageRating = reviewCount > 0 ? Number((Number(stats?.averageRating) || 0).toFixed(1)) : 0;

  await db.collection('professionals').updateOne(
    { $or: [{ id: professionalId }, { userId: professionalId }] },
    {
      $set: {
        'publicProfile.rating': averageRating,
        'publicProfile.reviewCount': reviewCount,
        updatedAt: new Date(),
      },
    }
  );

  return { rating: averageRating, reviewCount };
}