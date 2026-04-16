import nextEnv from '@next/env';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function getServiceAccount() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan variables Firebase Admin en .env.local');
  }

  return { projectId, clientEmail, privateKey };
}

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: cert(getServiceAccount()) });
}

async function run() {
  const email = process.argv[2] || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || '';

  if (!email) {
    console.error('Uso: node scripts/validate-auth-setup.mjs <EMAIL_SUPER_ADMIN>');
    process.exit(1);
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const userRecord = await auth.getUserByEmail(email);
  const roleDocRef = firestore.collection('roles_super_admin').doc(userRecord.uid);
  const userDocRef = firestore.collection('users').doc(userRecord.uid);

  const [roleDoc, userDoc] = await Promise.all([roleDocRef.get(), userDocRef.get()]);
  const userRole = String(userDoc.data()?.role || '').toLowerCase();

  console.log('Validacion de autenticacion y roles');
  console.log(`Email: ${userRecord.email}`);
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Email verificado: ${userRecord.emailVerified ? 'si' : 'no'}`);
  console.log(`roles_super_admin existe: ${roleDoc.exists ? 'si' : 'no'}`);
  console.log(`users/{uid} existe: ${userDoc.exists ? 'si' : 'no'}`);
  console.log(`users.role: ${userRole || '(vacio)'}`);
  console.log(`Super admin valido: ${roleDoc.exists || userRole === 'super_admin' || userRole === 'super-admin' ? 'si' : 'no'}`);
}

run().catch((error) => {
  console.error('No se pudo validar la configuracion:', error.message || error);
  process.exit(1);
});
