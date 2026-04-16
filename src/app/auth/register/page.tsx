'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useState } from 'react';

type AuthErrorCode =
  | 'auth/email-already-in-use'
  | 'auth/invalid-email'
  | 'auth/weak-password'
  | 'auth/operation-not-allowed';

function getAuthErrorCode(error: unknown): AuthErrorCode | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'auth/email-already-in-use' ||
      code === 'auth/invalid-email' ||
      code === 'auth/weak-password' ||
      code === 'auth/operation-not-allowed'
    ) {
      return code;
    }
  }
  return null;
}

const formSchema = z
  .object({
    name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }),
    email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
    password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

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

export default function RegisterPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error de configuración',
        description: 'Los servicios de autenticación no están disponibles en este momento.',
      });
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: values.name,
      });

      // Default flow for creating a Professional user
      const professionalDocRef = doc(firestore, 'professionals', user.uid);
      const userDocRef = doc(firestore, 'users', user.uid);
      
      const professionalData = {
        id: user.uid,
        userId: user.uid,
        name: values.name,
        specialty: "No especificada",
        licenseNumber: "N/A",
        whatsappNumber: '',
        address: "No especificada",
        workingHours: JSON.stringify({}),
        appointmentDuration: 30,
        messages: JSON.stringify({}),
        subscription: JSON.stringify({}),
        publicProfile: {
          enabled: false,
          verified: false,
          slug: slugify(values.name),
          bio: '',
          insurances: [],
          rating: 0,
          reviewCount: 0,
          mapUrl: ''
        },
        stats: JSON.stringify({}),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      setDocumentNonBlocking(professionalDocRef, professionalData, { merge: false });
      
      const userData = {
        id: user.uid,
        email: user.email,
        displayName: values.name,
        role: "professional",
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      setDocumentNonBlocking(userDocRef, userData, { merge: false });

      // Guardar también en MongoDB para que el dashboard lo encuentre
      try {
        const mongoResponse = await fetchWithAuth('/api/dashboard/professional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.uid,
            userId: user.uid,
            name: values.name,
            email: user.email,
            whatsappNumber: '',
          }),
        });

        if (!mongoResponse.ok) {
          const payload = await mongoResponse.json().catch(() => ({}));
          throw new Error(payload?.error || 'No se pudo crear el perfil en MongoDB.');
        }
      } catch (mongoError) {
        console.error('No se pudo guardar el perfil en MongoDB:', mongoError);
        toast({
          variant: 'destructive',
          title: 'Registro parcial',
          description: 'La cuenta se creó, pero no pudimos guardar el perfil en la base de datos.',
        });
      }

      try {
        await sendEmailVerification(user);
      } catch (verificationError) {
        console.error('No se pudo enviar el email de verificación:', verificationError);
      }

      await signOut(auth);

      toast({
        title: '¡Cuenta de Profesional Creada!',
        description: 'Revisa tu email para activar la cuenta antes de iniciar sesión.',
      });

      router.push('/auth/login');

    } catch (error: unknown) {
      const code = getAuthErrorCode(error);
      let description = 'Ocurrió un error al crear tu cuenta.';

      if (code === 'auth/email-already-in-use') {
        const message = 'Este email ya está registrado. Por favor, intenta iniciar sesión.';
        form.setError('email', { type: 'manual', message });
        description = message;
      } else if (code === 'auth/invalid-email') {
        const message = 'El formato del email no es válido.';
        form.setError('email', { type: 'manual', message });
        description = message;
      } else if (code === 'auth/weak-password') {
        const message = 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
        form.setError('password', { type: 'manual', message });
        description = message;
      } else if (code === 'auth/operation-not-allowed') {
        description = 'El registro con email y contraseña no está habilitado en Firebase Auth.';
      } else {
        console.error(error);
      }
      
      toast({
        variant: 'destructive',
        title: 'Error al registrar',
        description,
      });
    }
  }

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
                Activa tu perfil profesional y empieza a recibir reservas con una imagen más ordenada.
              </h1>
              <p className="max-w-lg text-sm leading-6 text-white/78">
                Configura tu cuenta, centraliza tu agenda y deja preparada tu base de pacientes para trabajar desde un solo panel.
              </p>
            </div>
          </div>

          <div className="relative grid gap-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="overflow-hidden rounded-[26px] border border-white/12 bg-white/8 p-3">
                <Image
                  src="/register-app-illustration.svg"
                  alt="Vista ilustrada de alta profesional en MediTurnos"
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
                src="/register-app-illustration.svg"
                alt="Vista ilustrada del alta profesional en formato mobile"
                width={720}
                height={520}
                className="h-auto w-full rounded-[18px]"
                priority
              />
            </div>

            <div className="mb-6 space-y-3 sm:mb-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Registro
              </span>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Crea tu cuenta profesional</h2>
                <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  Da el alta de tu espacio en MediTurnos. Al finalizar, te enviaremos un correo para verificar tu cuenta y habilitar el acceso.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-white/90 p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <Button type="button" variant="outline" className="mb-5 h-12 w-full rounded-2xl border-border/80 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-muted/50" onClick={() => void handleGoogleSignIn()} disabled={form.formState.isSubmitting || isGoogleSigningIn}>
                {isGoogleSigningIn ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirigiendo a Google...</> : <><GoogleIcon /> <span>Iniciar sesión con Google</span></>}
              </Button>
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/70" />
                </div>
                <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-[0.22em]">
                  <span className="bg-white px-3 text-muted-foreground">o crea tu cuenta con email</span>
                </div>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11" placeholder="Dr. Juan Pérez" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11" placeholder="nombre@ejemplo.com" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11" placeholder="Mínimo 8 caracteres" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type="password" className="h-12 rounded-2xl border-border/70 bg-muted/20 pl-11" placeholder="Repite tu contraseña" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold shadow-[0_14px_30px_rgba(232,89,89,0.22)]" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</> : <><span>Crear cuenta</span><ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </form>
              </Form>
            </div>

            <div className="mt-5 rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-center text-sm text-muted-foreground sm:mt-6">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/auth/login" className="font-semibold text-primary transition-colors hover:text-primary/80">
                Inicia sesión
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
