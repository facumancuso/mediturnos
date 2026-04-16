import { createHmac, timingSafeEqual } from 'crypto';
import { format } from 'date-fns';
import type { Db } from 'mongodb';

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
].join(' ');

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export type GoogleIntegrationStatus = {
  connected: boolean;
  email?: string;
  calendarId?: string;
  updatedAt?: string;
};

export type GoogleOAuthMode = 'connect' | 'login';

type GoogleOAuthStatePayload = {
  professionalId?: string;
  mode: GoogleOAuthMode;
  ts: number;
};

export type GoogleUserProfile = {
  email?: string;
  name?: string;
  picture?: string;
};

type GoogleIntegrationDoc = {
  professionalId: string;
  provider: 'google-calendar';
  connected: boolean;
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  scope?: string;
  expiryDate: number;
  calendarId: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export function getMissingGoogleOAuthConfig() {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  return missing;
}

export function isGoogleOAuthConfigured() {
  return getMissingGoogleOAuthConfig().length === 0;
}

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/integrations/google/callback`;

  const missing = getMissingGoogleOAuthConfig();
  if (missing.length > 0) {
    throw new Error(`GOOGLE_OAUTH_NOT_CONFIGURED:${missing.join(',')}`);
  }

  return { clientId, clientSecret, redirectUri };
}

function getStateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'mediturnos-google-state';
}

function signState(payloadBase64: string) {
  return createHmac('sha256', getStateSecret()).update(payloadBase64).digest('base64url');
}

export function buildGoogleOAuthState(
  professionalId: string,
  options?: { mode?: GoogleOAuthMode }
) {
  const payloadObject: GoogleOAuthStatePayload = {
    professionalId,
    mode: options?.mode || 'connect',
    ts: Date.now(),
  };

  const payload = Buffer.from(
    JSON.stringify(payloadObject),
    'utf8'
  ).toString('base64url');
  const signature = signState(payload);
  return `${payload}.${signature}`;
}

export function buildGoogleLoginOAuthState() {
  const payload = Buffer.from(
    JSON.stringify({ mode: 'login', ts: Date.now() } satisfies GoogleOAuthStatePayload),
    'utf8'
  ).toString('base64url');
  const signature = signState(payload);
  return `${payload}.${signature}`;
}

export function parseGoogleOAuthState(state: string) {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) {
    throw new Error('STATE_INVALID');
  }

  const expected = signState(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('STATE_INVALID');
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleOAuthStatePayload;

  if (!parsed.ts || (parsed.mode !== 'connect' && parsed.mode !== 'login')) {
    throw new Error('STATE_INVALID');
  }

  if (Date.now() - parsed.ts > 15 * 60_000) {
    throw new Error('STATE_EXPIRED');
  }

  if (parsed.mode === 'connect' && !parsed.professionalId) {
    throw new Error('STATE_INVALID');
  }

  return parsed;
}

export function buildGoogleConnectUrl(state: string) {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_SCOPE,
    state,
  });
  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

export async function exchangeCodeForGoogleTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED:${errorText}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`GOOGLE_TOKEN_REFRESH_FAILED:${errorText}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  const profile = await fetchGoogleUserProfile(accessToken);
  return profile.email;
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as GoogleUserProfile;
}

function integrationsCollection(db: Db) {
  return db.collection<GoogleIntegrationDoc>('professional_integrations');
}

async function getOrCreateMediturnosCalendar(accessToken: string): Promise<string> {
  // Buscar si ya existe un calendario 'MediTurnos'
  const listRes = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (listRes.ok) {
    const list = (await listRes.json()) as { items?: Array<{ id: string; summary: string }> };
    const existing = list.items?.find((c) => c.summary === 'MediTurnos');
    if (existing?.id) return existing.id;
  }

  // Crear el calendario 'MediTurnos'
  const createRes = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: 'MediTurnos', timeZone: DEFAULT_TIMEZONE }),
    cache: 'no-store',
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { id?: string };
    if (created.id) return created.id;
  }

  // Fallback a primary si falla la creación
  console.warn('[MediTurnos] No se pudo crear/encontrar calendario MediTurnos, usando primary');
  return 'primary';
}

export async function upsertGoogleIntegration(
  db: Db,
  professionalId: string,
  token: GoogleTokenResponse
) {
  const now = new Date();
  const email = await fetchGoogleUserEmail(token.access_token);

  const existing = await integrationsCollection(db).findOne({
    professionalId,
    provider: 'google-calendar',
  });

  const refreshToken = token.refresh_token || existing?.refreshToken;
  if (!refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN_MISSING');
  }

  await integrationsCollection(db).updateOne(
    { professionalId, provider: 'google-calendar' },
    {
      $set: {
        connected: true,
        accessToken: token.access_token,
        refreshToken,
        tokenType: token.token_type,
        scope: token.scope,
        expiryDate: now.getTime() + Math.max(30, token.expires_in || 3600) * 1000,
        calendarId:
          existing?.calendarId && existing.calendarId !== 'primary'
            ? existing.calendarId
            : await getOrCreateMediturnosCalendar(token.access_token),
        email: email || existing?.email,
        updatedAt: now,
      },
      $setOnInsert: {
        professionalId,
        provider: 'google-calendar' as const,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function getGoogleIntegrationStatus(db: Db, professionalId: string): Promise<GoogleIntegrationStatus> {
  const integration = await integrationsCollection(db).findOne({
    professionalId,
    provider: 'google-calendar',
    connected: true,
  });

  if (!integration) {
    return { connected: false };
  }

  return {
    connected: true,
    email: integration.email,
    calendarId: integration.calendarId,
    updatedAt: integration.updatedAt?.toISOString(),
  };
}

export async function disconnectGoogleIntegration(db: Db, professionalId: string) {
  await integrationsCollection(db).deleteOne({
    professionalId,
    provider: 'google-calendar',
  });
}

async function getValidAccessToken(db: Db, professionalId: string) {
  const integration = await integrationsCollection(db).findOne({
    professionalId,
    provider: 'google-calendar',
    connected: true,
  });

  if (!integration) {
    return null;
  }

  const nowMs = Date.now();
  if (integration.expiryDate && integration.expiryDate - nowMs > 60_000) {
    return integration;
  }

  const refreshed = await refreshGoogleAccessToken(integration.refreshToken);
  const updatedAt = new Date();
  const nextExpiry = updatedAt.getTime() + Math.max(30, refreshed.expires_in || 3600) * 1000;

  await integrationsCollection(db).updateOne(
    { professionalId, provider: 'google-calendar' },
    {
      $set: {
        accessToken: refreshed.access_token,
        tokenType: refreshed.token_type || integration.tokenType,
        scope: refreshed.scope || integration.scope,
        expiryDate: nextExpiry,
        updatedAt,
      },
    }
  );

  return {
    ...integration,
    accessToken: refreshed.access_token,
    tokenType: refreshed.token_type || integration.tokenType,
    scope: refreshed.scope || integration.scope,
    expiryDate: nextExpiry,
    updatedAt,
  };
}

function buildAppointmentDateTime(appointment: Record<string, any>) {
  const startDate = new Date(appointment.date);
  const [hours, minutes] = String(appointment.time || '00:00').split(':').map(Number);
  startDate.setHours(hours || 0, minutes || 0, 0, 0);
  const endDate = new Date(startDate.getTime() + (Number(appointment.duration) || 30) * 60_000);
  return { startDate, endDate };
}

function buildEventPayload(params: {
  appointment: Record<string, any>;
  professionalName: string;
  professionalAddress?: string;
}) {
  const { startDate, endDate } = buildAppointmentDateTime(params.appointment);
  const patientName = params.appointment.patientName || 'Paciente';
  const dateLabel = format(startDate, "eeee dd 'de' MMMM yyyy, HH:mm", { locale: undefined });

  return {
    summary: `Turno: ${patientName} con ${params.professionalName}`,
    description: [
      `Paciente: ${patientName}`,
      `Horario: ${dateLabel}`,
      `Estado: ${params.appointment.status || 'confirmed'}`,
      'Generado por MediTurnos.',
    ].join('\n'),
    location: params.professionalAddress || '',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: DEFAULT_TIMEZONE,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: DEFAULT_TIMEZONE,
    },
  };
}

export async function syncAppointmentToGoogleCalendar(params: {
  db: Db;
  professionalId: string;
  appointmentObjectId: any;
  appointment: Record<string, any>;
  professionalName: string;
  professionalAddress?: string;
}) {
  console.log('[GCal sync] Inicio — professionalId:', params.professionalId, '| appointmentId:', params.appointmentObjectId?.toString());

  let integration: Awaited<ReturnType<typeof getValidAccessToken>>;
  try {
    integration = await getValidAccessToken(params.db, params.professionalId);
  } catch (err) {
    console.error('[GCal sync] Error obteniendo token:', err);
    return { synced: false, reason: `token-error:${String(err)}` };
  }

  if (!integration) {
    console.warn('[GCal sync] No hay integración activa para professionalId:', params.professionalId);
    return { synced: false, reason: 'not-connected' as const };
  }

  console.log('[GCal sync] Integración encontrada — calendarId:', integration.calendarId, '| email:', integration.email);

  const rawCalendarId = integration.calendarId || 'primary';
  const calendarId = encodeURIComponent(rawCalendarId);
  const eventPayload = buildEventPayload({
    appointment: params.appointment,
    professionalName: params.professionalName,
    professionalAddress: params.professionalAddress,
  });

  const existingEventId = params.appointment.googleCalendarEventId;
  console.log('[GCal sync] existingEventId:', existingEventId ?? '(ninguno — se creará nuevo evento)');

  const endpoint = existingEventId
    ? `${GOOGLE_CALENDAR_API_BASE}/calendars/${calendarId}/events/${encodeURIComponent(existingEventId)}`
    : `${GOOGLE_CALENDAR_API_BASE}/calendars/${calendarId}/events`;

  console.log('[GCal sync] Método:', existingEventId ? 'PATCH' : 'POST', '| Endpoint:', endpoint);

  const response = await fetch(endpoint, {
    method: existingEventId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  console.log('[GCal sync] Respuesta HTTP:', response.status, response.statusText);

  let finalResponse = response;
  if (!response.ok && existingEventId && response.status === 404) {
    // Si el evento guardado ya no existe en Google, recrearlo y actualizar el ID local.
    console.warn('[GCal sync] EventId previo no encontrado (404). Se recreará el evento.');

    if (rawCalendarId !== 'primary') {
      const legacyEndpoint = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent('primary')}/events/${encodeURIComponent(existingEventId)}`;
      const legacyDelete = await fetch(legacyEndpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      });
      console.log('[GCal sync] Limpieza legacy en primary:', legacyDelete.status, legacyDelete.statusText);
    }

    finalResponse = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });
    console.log('[GCal sync] Reintento con POST HTTP:', finalResponse.status, finalResponse.statusText);
  }

  if (!finalResponse.ok) {
    const errorText = await finalResponse.text().catch(() => '');
    console.error('[GCal sync] Error de Google API:', errorText);
    return { synced: false, reason: `google-api-error:${errorText}` as const };
  }

  const data = (await finalResponse.json()) as { id?: string };
  const eventId = data.id;
  console.log('[GCal sync] Evento creado/actualizado — eventId:', eventId);

  if (eventId) {
    await params.db.collection('appointments').updateOne(
      { _id: params.appointmentObjectId },
      {
        $set: {
          googleCalendarEventId: eventId,
          googleCalendarSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    console.log('[GCal sync] googleCalendarEventId guardado en MongoDB ✓');
  }

  return { synced: true, eventId };
}

export async function removeAppointmentFromGoogleCalendar(params: {
  db: Db;
  professionalId: string;
  appointment: Record<string, any>;
  appointmentObjectId?: any;
}) {
  const eventId = params.appointment.googleCalendarEventId;
  if (!eventId) {
    return { synced: false, reason: 'missing-event-id' as const };
  }

  const integration = await getValidAccessToken(params.db, params.professionalId);
  if (!integration) {
    return { synced: false, reason: 'not-connected' as const };
  }

  const calendarId = encodeURIComponent(integration.calendarId || 'primary');
  const endpoint = `${GOOGLE_CALENDAR_API_BASE}/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => '');
    return { synced: false, reason: `google-api-error:${errorText}` as const };
  }

  if (params.appointmentObjectId) {
    await params.db.collection('appointments').updateOne(
      { _id: params.appointmentObjectId },
      {
        $unset: {
          googleCalendarEventId: '',
          googleCalendarSyncedAt: '',
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );
  }

  return { synced: true };
}
