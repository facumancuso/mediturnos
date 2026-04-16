import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';
import {
  exchangeCodeForGoogleTokens,
  fetchGoogleUserProfile,
  parseGoogleOAuthState,
  upsertGoogleIntegration,
} from '@/lib/google-calendar';
import { PROFESSIONAL_BRAND_COVER_URL } from '@/lib/branding';
import {
  createFirebaseCustomToken,
  getOrCreateFirebaseUserByEmail,
  provisionProfessionalUserRecords,
} from '@/lib/firebase-admin';

function buildRedirectUrl(status: 'connected' | 'error', message?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL('/dashboard/configuracion', appUrl);
  url.searchParams.set('integration', 'google');
  url.searchParams.set('status', status);
  if (message) {
    url.searchParams.set('message', message.slice(0, 120));
  }
  return url;
}

function buildGoogleLoginRedirectUrl(exchangeCode: string, message?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL('/auth/google/complete', appUrl);
  url.searchParams.set('exchange', exchangeCode);
  if (message) {
    url.searchParams.set('message', message.slice(0, 160));
  }
  return url;
}

export async function GET(request: Request) {
  let currentMode: 'connect' | 'login' = 'connect';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      if (currentMode === 'login') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const loginUrl = new URL('/auth/login', appUrl);
        loginUrl.searchParams.set('googleError', '1');
        return NextResponse.redirect(loginUrl);
      }

      return NextResponse.redirect(buildRedirectUrl('error', 'Conexión cancelada por el usuario.'));
    }

    if (!code || !state) {
      return NextResponse.redirect(buildRedirectUrl('error', 'Parámetros inválidos en callback.'));
    }

    const statePayload = parseGoogleOAuthState(state);
    currentMode = statePayload.mode;
    const tokenResponse = await exchangeCodeForGoogleTokens(code);

    const db = await getMongoDb();

    if (statePayload.mode === 'login') {
      const profile = await fetchGoogleUserProfile(tokenResponse.access_token);
      if (!profile.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const loginUrl = new URL('/auth/login', appUrl);
        loginUrl.searchParams.set('googleError', '1');
        loginUrl.searchParams.set('message', 'Google no devolvió un email válido para iniciar sesión.');
        return NextResponse.redirect(loginUrl);
      }

      const authUser = await getOrCreateFirebaseUserByEmail({
        email: profile.email,
        displayName: profile.name || profile.email.split('@')[0] || 'Profesional',
        photoURL: profile.picture,
      });

      await provisionProfessionalUserRecords({
        uid: authUser.uid,
        email: profile.email,
        displayName: authUser.displayName || profile.name || 'Profesional',
        photoURL: profile.picture || authUser.photoURL || undefined,
      });

      const currentProfessional = await db.collection('professionals').findOne({ id: authUser.uid });
      const displayName = authUser.displayName || profile.name || currentProfessional?.name || 'Profesional';
      const publicProfile = {
        enabled: currentProfessional?.publicProfile?.enabled ?? true,
        verified: currentProfessional?.publicProfile?.verified ?? false,
        slug:
          currentProfessional?.publicProfile?.slug ||
          displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        bio: currentProfessional?.publicProfile?.bio || '',
        insurances: currentProfessional?.publicProfile?.insurances || [],
        rating: currentProfessional?.publicProfile?.rating || 0,
        reviewCount: currentProfessional?.publicProfile?.reviewCount || 0,
        mapUrl: currentProfessional?.publicProfile?.mapUrl || '',
      };

      await db.collection('professionals').updateOne(
        { id: authUser.uid },
        {
          $set: {
            id: authUser.uid,
            userId: authUser.uid,
            name: displayName,
            email: profile.email,
            role: currentProfessional?.role || 'professional_owner',
            specialty: currentProfessional?.specialty || 'No especificada',
            licenseNumber: currentProfessional?.licenseNumber || 'N/A',
            whatsappNumber: currentProfessional?.whatsappNumber || '',
            address: currentProfessional?.address || 'No especificada',
            photoURL: currentProfessional?.photoURL || profile.picture || `https://picsum.photos/seed/${authUser.uid}/100/100`,
            coverImageUrl: PROFESSIONAL_BRAND_COVER_URL,
            appointmentDuration: currentProfessional?.appointmentDuration || 30,
            publicProfile,
            isActive: currentProfessional?.isActive ?? true,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      await upsertGoogleIntegration(db, authUser.uid, tokenResponse);

      const customToken = await createFirebaseCustomToken(authUser.uid);
      const exchangeCode = randomBytes(24).toString('hex');

      await db.collection('google_auth_exchanges').insertOne({
        exchangeCode,
        customToken,
        uid: authUser.uid,
        createdAt: new Date(),
      });

      return NextResponse.redirect(
        buildGoogleLoginRedirectUrl(exchangeCode, 'Tu cuenta de Google quedó conectada con Calendar.')
      );
    }

    await upsertGoogleIntegration(db, statePayload.professionalId!, tokenResponse);

    return NextResponse.redirect(buildRedirectUrl('connected'));
  } catch (error) {
    console.error('Error en callback Google Calendar:', error);
    if (currentMode === 'login') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const loginUrl = new URL('/auth/login', appUrl);
      loginUrl.searchParams.set('googleError', '1');
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(buildRedirectUrl('error', 'No se pudo completar la conexión.'));
  }
}
