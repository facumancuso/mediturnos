const APPOINTMENTS_CACHE_TTL_MS = 60_000;

type CachedValue = {
  expiresAt: number;
  payload: unknown;
};

const appointmentsCache = new Map<string, CachedValue>();

export function buildAppointmentsCacheKey(params: {
  professionalId: string;
  day?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  patientId?: string | null;
  isPublic: boolean;
  onlyDates?: boolean;
}) {
  return [
    params.professionalId,
    params.day || '',
    params.start || '',
    params.end || '',
    params.status || '',
    params.patientId || '',
    params.isPublic ? 'public' : 'auth',
    params.onlyDates ? 'dates-only' : '',
  ].join('|');
}

export function getCachedAppointments<T>(key: string) {
  const cached = appointmentsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    appointmentsCache.delete(key);
    return null;
  }
  return cached.payload as T;
}

export function setCachedAppointments(key: string, payload: unknown) {
  appointmentsCache.set(key, {
    expiresAt: Date.now() + APPOINTMENTS_CACHE_TTL_MS,
    payload,
  });
}

export function invalidateAppointmentsReadCache(professionalId: string) {
  const prefix = `${professionalId}|`;
  for (const key of appointmentsCache.keys()) {
    if (key.startsWith(prefix)) {
      appointmentsCache.delete(key);
    }
  }
}
