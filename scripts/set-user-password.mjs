import nextEnv from '@next/env';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function getServiceAccount() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL o FIREBASE_ADMIN_PRIVATE_KEY en .env.local'
    );
  }

  return { projectId, clientEmail, privateKey };
}

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: cert(getServiceAccount()) });
}

async function run() {
  const email = process.argv[2] || '';
  const newPassword = process.argv[3] || '';

  if (!email || !newPassword) {
    console.error('Uso: node scripts/set-user-password.mjs <EMAIL> <NUEVA_PASSWORD>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('La nueva contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);

  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, {
    password: newPassword,
  });

  console.log('Contraseña actualizada correctamente.');
  console.log(`UID: ${user.uid}`);
  console.log(`Email: ${user.email}`);
}

run().catch((error) => {
  console.error('No se pudo actualizar la contraseña:', error.message || error);
  process.exit(1);
});
