'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';

const mfaCodeFormSchema = z.object({
  code: z.string().min(6, { message: 'Ingresa un código válido (TOTP o backup).' }),
});

const emailFormSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' }),
});

type LoginAuthErrorCode =
  | 'auth/invalid-credential'
  | 'auth/wrong-password'
  | 'auth/user-not-found'
  | 'auth/invalid-email'
  | 'auth/too-many-requests'
  | 'auth/operation-not-allowed'
  | 'auth/network-request-failed';

function getLoginAuthErrorCode(error: unknown): LoginAuthErrorCode | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email' ||
      code === 'auth/too-many-requests' ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/network-request-failed'
    ) {
      return code;
    }
  }
  return null;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.81 12.23c0-.72-.06-1.25-.19-1.8H12.2v3.56h5.53c-.11.88-.69 2.2-1.97 3.09l-.02.12 2.85 2.16.2.02c1.82-1.64 2.87-4.06 2.87-7.15Z"
        fill="#4285F4"
      />
      <path
        d="M12.2 21.88c2.71 0 4.98-.87 6.64-2.37l-3.17-2.3c-.85.58-1.99.98-3.47.98-2.66 0-4.92-1.72-5.73-4.1l-.11.01-2.96 2.24-.04.1c1.65 3.2 5.05 5.44 8.84 5.44Z"
        fill="#34A853"
      />
      <path
        d="M6.47 14.09a5.76 5.76 0 0 1-.34-2.01c0-.7.13-1.38.33-2.01l-.01-.13-3-2.28-.1.05A9.7 9.7 0 0 0 2.3 12.08c0 1.57.39 3.06 1.06 4.37l3.11-2.36Z"
        fill="#FBBC05"
      />
      <path
        d="M12.2 5.97c1.87 0 3.13.79 3.85 1.46l2.81-2.68C17.17 3.18 14.91 2.28 12.2 2.28c-3.79 0-7.19 2.24-8.84 5.44l3.11 2.36c.82-2.38 3.07-4.1 5.73-4.1Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

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
      const isSuperAdminUserDoc =
        userDoc.exists() && (userRole === 'super_admin' || userRole === 'super-admin');

      if (superAdminDoc.exists() || isSuperAdminUserDoc) {
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
      const code = getLoginAuthErrorCode(error);
      let description = 'No se pudo iniciar sesión.';

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        description = 'La contraseña es incorrecta.';
      } else if (code === 'auth/user-not-found') {
        description = 'No existe una cuenta con ese email.';
      } else if (code === 'auth/invalid-email') {
        description = 'El email no tiene un formato válido.';
      } else if (code === 'auth/too-many-requests') {
        description = 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
      } else if (code === 'auth/operation-not-allowed') {
        description = 'El login con email y contraseña no está habilitado en Firebase Auth.';
      } else if (code === 'auth/network-request-failed') {
        description = 'No se pudo conectar a Firebase. Revisa tu conexión de red.';
      } else {
        console.error('Error de login no tipado:', error);
      }

      toast({
        variant: 'destructive',
        title: 'Error al iniciar sesión',
        description,
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

      const payload = (await response.json().catch(() => ({}))) as {
        verified?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.verified) {
        throw new Error(payload.error || 'Código MFA inválido.');
      }

      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error('No se encontró la sesión del usuario luego de verificar MFA.');
      }

      const route = await getPostLoginRoute(currentUser.uid);
      setRequiresMfa(false);
      setMfaToken(null);
      mfaForm.reset();

      toast({
        title: 'MFA verificado',
        description: 'Has iniciado sesión correctamente.',
      });
      router.push(route);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al verificar MFA',
        description: error instanceof Error ? error.message : 'No se pudo verificar el segundo factor.',
      });
    } finally {
      setIsVerifyingMfa(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('googleError') !== '1') return;

    toast({
      variant: 'destructive',
      title: 'Error con Google',
      description: 'No se pudo completar el acceso con Google. Intenta nuevamente.',
    });
  }, [searchParams, toast]);

  async function handleGoogleSignIn() {
    try {
      setIsGoogleSigningIn(true);
      const response = await fetch('/api/auth/google/start', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as {
        authUrl?: string;
        error?: string;
        code?: string;
        missing?: string[];
      };

      if (!response.ok || !payload.authUrl) {
        if (payload.code === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
          const missing = Array.isArray(payload.missing) ? payload.missing.join(', ') : '';
          throw new Error(
            missing
              ? `Google OAuth no está configurado. Variables faltantes: ${missing}.`
              : 'Google OAuth no está configurado en el servidor.'
          );
        }

        throw new Error(payload.error || 'No se pudo iniciar el acceso con Google.');
      }

      window.location.href = payload.authUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error con Google',
        description: error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.',
      });
      setIsGoogleSigningIn(false);
    }
  }

  return (
    <div className="w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/60 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:rounded-[32px]">
      <div className="grid lg:min-h-[720px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(160deg,_rgba(232,89,89,0.96)_0%,_rgba(187,54,54,0.94)_48%,_rgba(120,32,32,0.98)_100%)] p-10 text-white lg:flex lg:min-h-[760px] lg:flex-col lg:justify-between">
          <div className="absolute inset-0">
            <div className="absolute left-10 top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-16 right-0 h-56 w-56 rounded-full bg-amber-200/20 blur-3xl" />
            <div className="absolute inset-y-0 right-0 w-px bg-white/15" />
          </div>
          <div className="relative space-y-6">
            <Link href="/" className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/14">
              <div className="[&_.text-primary]:text-white [&_.text-xl]:text-2xl [&_svg]:text-white">
                <Logo />
              </div>
            </Link>
            <div className="space-y-4">
              <h1 className="max-w-md text-4xl font-semibold leading-tight">
                Gestiona turnos, pacientes y agenda desde un solo lugar.
              </h1>
              <p className="max-w-lg text-sm leading-6 text-white/78">
                Ingresa con tu cuenta para continuar trabajando con tu calendario, tus recordatorios y el panel administrativo.
              </p>
            </div>
          </div>

          <div className="relative grid gap-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="overflow-hidden rounded-[26px] border border-white/12 bg-white/8 p-3">
                <Image
                  src="/login-app-illustration.svg"
                  alt="Vista ilustrada de MediTurnos con agenda, pacientes y recordatorios"
                  width={720}
                  height={520}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(249,247,245,0.98)_100%)] p-5 sm:p-8 lg:p-10">
          <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
            <Link href="/" className="mb-5 inline-flex w-fit rounded-full border border-border/70 bg-white px-4 py-2 shadow-sm transition-colors hover:bg-muted/40 lg:hidden">
              <Logo />
            </Link>

            <div className="mb-6 overflow-hidden rounded-[22px] border border-primary/10 bg-primary/[0.045] p-3 sm:hidden">
              <Image
                src="/login-app-illustration.svg"
                alt="Vista ilustrada de MediTurnos en formato mobile"
                width={720}
                height={520}
                className="h-auto w-full rounded-[18px]"
                priority
              />
            </div>

            <div className="mb-6 space-y-3 sm:mb-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acceso
              </span>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Iniciar sesión</h2>
                <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  Entra a tu cuenta para administrar pacientes, turnos y recordatorios desde el panel principal.
                </p>
              </div>
            </div>

          {requiresMfa ? (
              <Form {...mfaForm}>
                <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-5 rounded-[24px] border border-border/70 bg-white p-5 shadow-sm sm:rounded-[28px] sm:p-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Verificación adicional</h3>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Ingresa el código de tu app autenticadora o un backup code.
                    </p>
                  </div>
                  <FormField
                    control={mfaForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código MFA</FormLabel>
                        <FormControl>
                          <Input className="h-12 rounded-2xl border-border/70 bg-muted/30" placeholder="123456 o ABCD1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={isVerifyingMfa}>
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
              <>
                <div className="rounded-[24px] border border-border/70 bg-white/90 p-4 shadow-sm sm:rounded-[28px] sm:p-6">
                  <Button type="button" variant="outline" className="mb-5 h-12 w-full rounded-2xl border-border/80 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-muted/50" onClick={() => void handleGoogleSignIn()} disabled={isSigningIn || isGoogleSigningIn}>
                    {isGoogleSigningIn ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirigiendo a Google...</> : <><GoogleIcon /> <span>Iniciar sesión con Google</span></>}
                  </Button>
                  <div className="relative mb-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/70" />
                    </div>
                    <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.22em]">
                      <span className="bg-white px-3 text-muted-foreground">o continúa con email</span>
                    </div>
                  </div>
                  <form onSubmit={onEmailSubmit} className="space-y-4" key="email-login-form">
                  {requiresEmailVerification && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email-login"
                        className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11"
                        placeholder="admin@mediturnos.com"
                        autoComplete="email"
                        value={emailCredentials.email}
                        onChange={(event) =>
                          setEmailCredentials((current) => ({ ...current, email: event.target.value }))
                        }
                      />
                    </div>
                    {emailErrors.email ? (
                      <p className="text-sm font-medium text-destructive">{emailErrors.email}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <label htmlFor="password-login" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
                      <Link href="/auth/forgot-password" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password-login"
                        type="password"
                        className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11"
                        placeholder="Tu contraseña"
                        autoComplete="current-password"
                        value={emailCredentials.password}
                        onChange={(event) =>
                          setEmailCredentials((current) => ({ ...current, password: event.target.value }))
                        }
                      />
                    </div>
                    {emailErrors.password ? (
                      <p className="text-sm font-medium text-destructive">{emailErrors.password}</p>
                    ) : null}
                  </div>

                  <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold shadow-[0_14px_30px_rgba(232,89,89,0.22)]" disabled={isSigningIn}>
                    {isSigningIn ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando sesión...</> : <><span>Iniciar sesión</span><ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                  </form>
                </div>
              </>
            )}
            <div className="mt-5 rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-center text-sm text-muted-foreground sm:mt-6">
              ¿No tienes una cuenta?{' '}
              <Link href="/auth/register" className="font-semibold text-primary transition-colors hover:text-primary/80">
                Regístrate
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
