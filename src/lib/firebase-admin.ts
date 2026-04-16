import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let firebaseAdminApp: App;

function getServiceAccount() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan variables Firebase Admin: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.'
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  if (getApps().length > 0) {
    firebaseAdminApp = getApps()[0]!;
    return firebaseAdminApp;
  }

  const serviceAccount = getServiceAccount();
  firebaseAdminApp = initializeApp({
    credential: cert(serviceAccount),
  });

  return firebaseAdminApp;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function createFirebaseCustomToken(uid: string) {
  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  return auth.createCustomToken(uid);
}

export async function getOrCreateFirebaseUserByEmail(params: {
  email: string;
  displayName?: string;
  photoURL?: string;
}) {
  const app = getFirebaseAdminApp();
  const auth = getAuth(app);

  try {
    const existing = await auth.getUserByEmail(params.email);

    await auth.updateUser(existing.uid, {
      displayName: params.displayName || existing.displayName || undefined,
      photoURL: params.photoURL || existing.photoURL || undefined,
      emailVerified: true,
    });

    return auth.getUser(existing.uid);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';

    if (!code.includes('user-not-found')) {
      throw error;
    }
  }

  return auth.createUser({
    email: params.email,
    emailVerified: true,
    displayName: params.displayName,
    photoURL: params.photoURL,
  });
}

export async function provisionProfessionalUserRecords(params: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}) {
  const app = getFirebaseAdminApp();
  const firestore = getFirestore(app);
  const now = new Date();

  const userRef = firestore.collection('users').doc(params.uid);
  const professionalRef = firestore.collection('professionals').doc(params.uid);

  await Promise.all([
    userRef.set(
      {
        id: params.uid,
        email: params.email,
        displayName: params.displayName,
        role: 'professional',
        photoURL: params.photoURL || '',
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    ),
    professionalRef.set(
      {
        id: params.uid,
        userId: params.uid,
        name: params.displayName,
        specialty: 'No especificada',
        licenseNumber: 'N/A',
        whatsappNumber: '',
        address: 'No especificada',
        workingHours: JSON.stringify({}),
        appointmentDuration: 30,
        messages: JSON.stringify({}),
        subscription: JSON.stringify({}),
        publicProfile: {
          enabled: false,
          verified: false,
          slug: slugify(params.displayName),
          bio: '',
          insurances: [],
          rating: 0,
          reviewCount: 0,
          mapUrl: '',
        },
        stats: JSON.stringify({}),
        isActive: true,
        photoURL: params.photoURL || '',
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    ),
  ]);
}

export async function verifyFirebaseIdToken(authHeader: string | null | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token de autorización faltante.');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Token de autorización inválido.');
  }

  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  return auth.verifyIdToken(token, true);
}
