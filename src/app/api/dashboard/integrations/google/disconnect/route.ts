import { NextResponse } from 'next/server';
import { requireRequestAuth } from '@/lib/request-auth';
import { getMongoDb } from '@/lib/mongodb';
import { disconnectGoogleIntegration } from '@/lib/google-calendar';

export async function POST(request: Request) {
  try {
    const authUser = await requireRequestAuth(request);
    const db = await getMongoDb();
    await disconnectGoogleIntegration(db, authUser.uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    console.error('Error desconectando Google Calendar:', error);
    return NextResponse.json(
      { error: 'No se pudo desconectar Google Calendar.' },
      { status: 500 }
    );
  }
}
