import { NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongodb';

const MAX_EXCHANGE_AGE_MS = 10 * 60_000;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const exchangeCode = String(body?.exchangeCode || '').trim();

    if (!exchangeCode) {
      return NextResponse.json({ error: 'exchangeCode es obligatorio.' }, { status: 400 });
    }

    const db = await getMongoDb();
    const collection = db.collection('google_auth_exchanges');
    const exchange = await collection.findOne({ exchangeCode });

    if (!exchange) {
      return NextResponse.json({ error: 'Intercambio inválido o expirado.' }, { status: 404 });
    }

    const createdAt = exchange.createdAt instanceof Date ? exchange.createdAt : new Date(exchange.createdAt);
    if (Date.now() - createdAt.getTime() > MAX_EXCHANGE_AGE_MS) {
      await collection.deleteOne({ _id: exchange._id });
      return NextResponse.json({ error: 'Intercambio expirado.' }, { status: 410 });
    }

    await collection.deleteOne({ _id: exchange._id });

    return NextResponse.json({
      customToken: exchange.customToken,
      uid: exchange.uid,
    });
  } catch (error) {
    console.error('Error intercambiando token de login Google:', error);
    return NextResponse.json({ error: 'No se pudo completar el login con Google.' }, { status: 500 });
  }
}
