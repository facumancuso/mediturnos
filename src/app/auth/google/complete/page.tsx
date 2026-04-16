'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';

export default function GoogleCompletePage() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const exchangeCode = searchParams.get('exchange');

    if (!exchangeCode) {
      setStatus('error');
      setErrorMessage('Falta el código de intercambio del login con Google.');
      return;
    }

    let cancelled = false;

    async function completeGoogleLogin() {
      try {
        const response = await fetch('/api/auth/google/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchangeCode }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          customToken?: string;
          error?: string;
        };

        if (!response.ok || !payload.customToken) {
          throw new Error(payload.error || 'No se pudo completar el intercambio con el servidor.');
        }

        await signInWithCustomToken(auth, payload.customToken);

        if (!cancelled) {
          router.replace('/dashboard');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.');
        }
      }
    }

    completeGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [auth, router, searchParams]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Acceso con Google</CardTitle>
        <CardDescription>
          {status === 'loading'
            ? 'Estamos terminando tu acceso y conectando tu calendario.'
            : 'No pudimos completar el acceso con Google.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finalizando autenticación...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/login">Volver al login</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
