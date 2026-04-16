export const firebaseConfig = {
  "projectId": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  "appId": process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  "apiKey": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  "authDomain": process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  "storageBucket": process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  "measurementId": process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  "messagingSenderId": process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''
};

const requiredFirebaseWebConfig = [
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['NEXT_PUBLIC_FIREBASE_APP_ID', firebaseConfig.appId],
  ['NEXT_PUBLIC_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
  ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
] as const;

export function getMissingFirebaseWebConfig() {
  return requiredFirebaseWebConfig
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function hasFirebaseWebConfig() {
  return getMissingFirebaseWebConfig().length === 0;
}
