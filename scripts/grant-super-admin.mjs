import nextEnv from '@next/env';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

async function run() {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const uidFlag = getArg('--uid');
  const emailFlag = getArg('--email');
  const nameFlag = getArg('--name');

  const positionalFirst = positional[0] || '';
  const positionalSecond = positional[1] || '';

  const uidArg = uidFlag || (positionalFirst && !positionalFirst.includes('@') ? positionalFirst : '');
  const emailArg = emailFlag || (positionalFirst.includes('@') ? positionalFirst : positionalSecond);
  const displayNameArg = nameFlag || (positionalSecond && !positionalSecond.includes('@') ? positionalSecond : process.argv[4] || 'Super Admin');

  if (!uidArg && !emailArg) {
    console.error('Uso: node scripts/grant-super-admin.mjs --uid <UID> [--email <EMAIL>] [--name <DISPLAY_NAME>]');
    console.error('  o: node scripts/grant-super-admin.mjs --email <EMAIL> [--name <DISPLAY_NAME>]');
    process.exit(1);
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  let uid = uidArg;
  let email = emailArg;
  let displayName = displayNameArg;

  if (!uid && email) {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    email = userRecord.email || email;
    displayName = userRecord.displayName || displayNameArg;
  }

  if (!uid) {
    throw new Error('No se pudo resolver UID del super admin.');
  }

  const roleRef = firestore.collection('roles_super_admin').doc(uid);
  const userRef = firestore.collection('users').doc(uid);

  await roleRef.set(
    {
      uid,
      email,
      grantedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: 'script:grant-super-admin',
    },
    { merge: true }
  );

  await userRef.set(
    {
      id: uid,
      email,
      displayName,
      role: 'super_admin',
      updatedAt: FieldValue.serverTimestamp(),
      ...(email ? {} : { email: FieldValue.delete() }),
    },
    { merge: true }
  );

  console.log('Super admin asignado correctamente.');
  console.log(`UID: ${uid}`);
  if (email) {
    console.log(`Email: ${email}`);
  }
}

run().catch((error) => {
  console.error('No se pudo asignar super admin:', error.message || error);
  process.exit(1);
});
