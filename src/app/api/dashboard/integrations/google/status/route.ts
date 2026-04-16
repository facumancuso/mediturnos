import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/lib/request-auth';
import { getMongoDb } from '@/lib/mongodb';
import { getGoogleIntegrationStatus, isGoogleOAuthConfigured } from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const db = await getMongoDb();
    const status = await getGoogleIntegrationStatus(db, authUser.uid);
    return NextResponse.json({
      ...status,
      available: isGoogleOAuthConfigured(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error consultando estado Google Calendar:', error);
    return NextResponse.json(
      { error: 'No se pudo obtener el estado de Google Calendar.' },
      { status: 500 }
    );
  }
}
