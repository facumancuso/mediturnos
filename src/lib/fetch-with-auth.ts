'use client';

import { initializeFirebase } from '@/firebase';

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const { auth } = initializeFirebase();
  const headers = new Headers(init.headers || {});

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
