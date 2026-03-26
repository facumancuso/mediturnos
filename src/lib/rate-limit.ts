import { getMongoDb } from '@/lib/mongodb';

type RateLimitOptions = {
  request: Request;
  keyPrefix: string;
  limit: number;
  windowMs: number;
  identifier?: string;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitDoc = {
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
  updatedAt: Date;
};

let indexesReady = false;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

async function ensureRateLimitIndexes() {
  if (indexesReady) return;

  const db = await getMongoDb();
  const collection = db.collection<RateLimitDoc>('api_rate_limits');

  await collection.createIndex({ key: 1 }, { unique: true });
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  indexesReady = true;
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { request, keyPrefix, limit, windowMs, identifier } = options;

  await ensureRateLimitIndexes();

  const now = Date.now();
  const currentWindowStart = Math.floor(now / windowMs) * windowMs;
  const windowStartDate = new Date(currentWindowStart);
  const windowEnd = currentWindowStart + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));

  const rateLimitKey = `${keyPrefix}:${identifier || getClientIp(request)}`;

  const db = await getMongoDb();
  const collection = db.collection<RateLimitDoc>('api_rate_limits');
  const existing = await collection.findOne({ key: rateLimitKey });

  if (!existing || existing.windowStart.getTime() !== currentWindowStart) {
    await collection.updateOne(
      { key: rateLimitKey },
      {
        $set: {
          key: rateLimitKey,
          count: 1,
          windowStart: windowStartDate,
          updatedAt: new Date(now),
          expiresAt: new Date(windowEnd + windowMs),
        },
      },
      { upsert: true }
    );

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  const nextCount = existing.count + 1;
  await collection.updateOne(
    { key: rateLimitKey },
    {
      $set: {
        count: nextCount,
        updatedAt: new Date(now),
        expiresAt: new Date(windowEnd + windowMs),
      },
    }
  );

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterSeconds,
  };
}
