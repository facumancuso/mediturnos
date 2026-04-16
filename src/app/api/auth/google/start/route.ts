import { NextResponse } from 'next/server';
import {
  buildGoogleConnectUrl,
  buildGoogleLoginOAuthState,
  getMissingGoogleOAuthConfig,
  isGoogleOAuthConfigured,
} from '@/lib/google-calendar';

export async function GET() {
  try {
    if (!isGoogleOAuthConfigured()) {
      return NextResponse.json(
        {
          error: 'Google OAuth no está configurado en el servidor.',
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          missing: getMissingGoogleOAuthConfig(),
        },
        { status: 503 }
      );
    }

    const state = buildGoogleLoginOAuthState();
    const authUrl = buildGoogleConnectUrl(state);
    return NextResponse.json({ authUrl });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GOOGLE_OAUTH_NOT_CONFIGURED:')) {
      const missing = error.message.split(':')[1]?.split(',').filter(Boolean) || [];
      return NextResponse.json(
        {
          error: 'Google OAuth no está configurado en el servidor.',
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          missing,
        },
        { status: 503 }
      );
    }

    console.error('Error iniciando login con Google:', error);
    return NextResponse.json(
      { error: 'No se pudo iniciar sesión con Google.' },
      { status: 500 }
    );
  }
}
