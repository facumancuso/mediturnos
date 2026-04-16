import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function run() {
  const email = process.argv[2] || '';
  const password = process.argv[3] || '';

  if (!email || !password) {
    console.error('Uso: node scripts/test-firebase-login.mjs <EMAIL> <PASSWORD>');
    process.exit(1);
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('No hay API key de Firebase disponible.');
    process.exit(1);
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const code = payload?.error?.message || 'UNKNOWN_ERROR';
    console.error(`Login fallido: ${code}`);
    process.exit(1);
  }

  console.log('Login correcto en Firebase Auth.');
  console.log(`UID: ${payload.localId}`);
  console.log(`Email verificado: ${payload.registered ? 'si' : 'no'}`);
}

run().catch((error) => {
  console.error('Error probando login:', error.message || error);
  process.exit(1);
});
