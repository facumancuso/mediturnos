import { firebaseConfig } from '@/firebase/config';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';

type AuthContext = {
  uid: string;
  email?: string;
  emailVerified: boolean;
};

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
    emailVerified?: boolean;
  }>;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function verifyIdTokenWithRestApi(idToken: string): Promise<AuthContext> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey;

  if (!apiKey) {
    throw new Error('UNAUTHORIZED_MISSING_FIREBASE_API_KEY');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('UNAUTHORIZED_INVALID_TOKEN');
  }

  const payload = (await response.json()) as FirebaseLookupResponse;
  const user = payload.users?.[0];

  if (!user?.localId) {
    throw new Error('UNAUTHORIZED_INVALID_TOKEN');
  }

  return {
    uid: user.localId,
    email: user.email,
    emailVerified: !!user.emailVerified,
  };
}

async function verifyIdToken(request: Request): Promise<AuthContext> {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('UNAUTHORIZED_MISSING_TOKEN');
  }

  try {
    const decoded = await verifyFirebaseIdToken(`Bearer ${token}`);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: !!decoded.email_verified,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Faltan variables Firebase Admin')) {
      return verifyIdTokenWithRestApi(token);
    }
    throw error;
  }
}

export async function getOptionalRequestAuth(request: Request): Promise<AuthContext | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyIdToken(request);
}

export async function requireRequestAuth(request: Request): Promise<AuthContext> {
  return verifyIdToken(request);
}
