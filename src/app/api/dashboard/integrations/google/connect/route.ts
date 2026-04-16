import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/lib/request-auth';
import {
  buildGoogleConnectUrl,
  buildGoogleOAuthState,
  getMissingGoogleOAuthConfig,
  isGoogleOAuthConfigured,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);

    if (!isGoogleOAuthConfigured()) {
      return NextResponse.json(
        {
          error: 'Google Calendar no está configurado en el servidor.',
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          missing: getMissingGoogleOAuthConfig(),
        },
        { status: 503 }
      );
    }

    const state = buildGoogleOAuthState(authUser.uid);
    const authUrl = buildGoogleConnectUrl(state);
    return NextResponse.json({ authUrl });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    if (error instanceof Error && error.message.startsWith('GOOGLE_OAUTH_NOT_CONFIGURED:')) {
      const missing = error.message.split(':')[1]?.split(',').filter(Boolean) || [];
      return NextResponse.json(
        {
          error: 'Google Calendar no está configurado en el servidor.',
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    console.error('Error iniciando conexión Google Calendar:', error);
    return NextResponse.json(
      { error: 'No se pudo iniciar la conexión con Google Calendar.' },
      { status: 500 }
    );
  }
}
