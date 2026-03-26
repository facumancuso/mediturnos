'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const mfaCodeFormSchema = z.object({
  code: z.string().min(6, { message: 'Ingresa un código válido (TOTP o backup).' }),
});

const emailFormSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' }),
});


export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [emailCredentials, setEmailCredentials] = useState({ email: '', password: '' });
  const [emailErrors, setEmailErrors] = useState<{ email?: string; password?: string }>({});
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationCredentials, setVerificationCredentials] = useState<{ email: string; password: string } | null>(null);

  const mfaForm = useForm<z.infer<typeof mfaCodeFormSchema>>({
    resolver: zodResolver(mfaCodeFormSchema),
    defaultValues: {
      code: '',
    },
  });

  async function checkIfMfaIsEnabled(idToken: string) {
    const response = await fetch('/api/auth/mfa/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('No se pudo validar el estado MFA.');
    }

    const data = (await response.json()) as { enabled: boolean };
    return !!data.enabled;
  }

  async function getPostLoginRoute(uid: string) {
    try {
      const superAdminDoc = await getDoc(doc(firestore, 'roles_super_admin', uid));
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      const userRole = String(userDoc.data()?.role || '').toLowerCase();
      const isAdminUserDoc = userDoc.exists() && userRole === 'admin';

      if (superAdminDoc.exists() || isAdminUserDoc) {
        return '/super-dashboard';
      }
    } catch (error) {
      console.error('No se pudo verificar rol superadmin:', error);
    }

    return '/dashboard';
  }

  async function onEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) return;

    const parsed = emailFormSchema.safeParse(emailCredentials);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setEmailErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setEmailErrors({});
    setRequiresEmailVerification(false);

    setIsSigningIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        parsed.data.email,
        parsed.data.password
      );
      await userCredential.user.reload();

      if (!userCredential.user.emailVerified) {
        setVerificationCredentials({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        setRequiresEmailVerification(true);
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Cuenta pendiente de activación',
          description: 'Verifica tu email para activar la cuenta antes de iniciar sesión.',
        });
        return;
      }

      const idToken = await userCredential.user.getIdToken(true);
      const hasMfaEnabled = await checkIfMfaIsEnabled(idToken);

      if (hasMfaEnabled) {
        setRequiresMfa(true);
        setMfaToken(idToken);
        toast({
          title: 'Segundo factor requerido',
          description: 'Ingresa tu código TOTP o un backup code para continuar.',
        });
        return;
      }

      const route = await getPostLoginRoute(userCredential.user.uid);
      toast({
        title: '¡Éxito!',
        description: 'Has iniciado sesión correctamente.',
      });
      router.push(route);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al iniciar sesión',
        description: 'Email o contraseña incorrectos, o el proveedor email/password no está habilitado.',
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function onResendVerificationEmail() {
    if (!auth || !verificationCredentials) return;

    setIsResendingVerification(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        verificationCredentials.email,
        verificationCredentials.password
      );

      await sendEmailVerification(credential.user);
      await signOut(auth);

      toast({
        title: 'Email reenviado',
        description: 'Te enviamos un nuevo enlace de verificación.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo reenviar',
        description: 'Intenta iniciar sesión nuevamente para reenviar el email de verificación.',
      });
      setVerificationCredentials(null);
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function onMfaSubmit(values: z.infer<typeof mfaCodeFormSchema>) {
    if (!mfaToken) return;

    setIsVerifyingMfa(true);
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mfaToken}`,
        },
        body: JSON.stringify({ code: values.code }),
      });

      if (!response.ok) {
        throw new Error('Código MFA inválido.');
      }

      toast({
        title: 'Segundo factor verificado',
        description: 'Autenticación completada correctamente.',
      });
      const uid = auth?.currentUser?.uid;
      const route = uid ? await getPostLoginRoute(uid) : '/dashboard';
      router.push(route);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error MFA',
        description: 'El código TOTP o backup code es inválido.',
      });
    } finally {
      setIsVerifyingMfa(false);
    }
  }

  return (
    <>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>Inicia sesión con email y contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
            {requiresMfa ? (
              <Form {...mfaForm}>
                <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Ingresa el código de tu app autenticadora o un backup code.
                  </p>
                  <FormField
                    control={mfaForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código MFA</FormLabel>
                        <FormControl>
                          <Input placeholder="123456 o ABCD1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isVerifyingMfa}>
                    {isVerifyingMfa ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando MFA...</> : 'Verificar segundo factor'}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setRequiresMfa(false);
                      setMfaToken(null);
                      mfaForm.reset();
                    }}
                  >
                    Volver al inicio de sesión
                  </Button>
                </form>
              </Form>
            ) : (
                <form onSubmit={onEmailSubmit} className="space-y-4" key="email-login-form">
                  {requiresEmailVerification && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">Tu cuenta aún no está verificada.</p>
                      <p className="mt-1">Revisa tu correo y confirma el enlace de activación.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={onResendVerificationEmail}
                        disabled={isResendingVerification || !verificationCredentials}
                      >
                        {isResendingVerification ? 'Reenviando...' : 'Reenviar email de verificación'}
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="email-login" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                    <Input
                      id="email-login"
                      placeholder="admin@mediturnos.com"
                      autoComplete="email"
                      value={emailCredentials.email}
                      onChange={(event) =>
                        setEmailCredentials((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                    {emailErrors.email ? (
                      <p className="text-sm font-medium text-destructive">{emailErrors.email}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password-login" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
                    <Input
                      id="password-login"
                      type="password"
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      value={emailCredentials.password}
                      onChange={(event) =>
                        setEmailCredentials((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                    {emailErrors.password ? (
                      <p className="text-sm font-medium text-destructive">{emailErrors.password}</p>
                    ) : null}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSigningIn}>
                    {isSigningIn ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando sesión...</> : 'Iniciar con email'}
                  </Button>
                </form>
            )}
          <div className="mt-4 text-center text-sm">
            <Link href="/auth/forgot-password" className="font-medium underline block mb-2">
              ¿Olvidaste tu contraseña?
            </Link>
            ¿No tienes una cuenta?{' '}
            <Link href="/auth/register" className="font-medium underline">
              Regístrate
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
