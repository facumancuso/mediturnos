'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

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

export default function RegisterPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Crea tu cuenta</CardTitle>
        <CardDescription>Regístrate para acceder a la plataforma. Después del registro, deberás verificar tu email para activar la cuenta e iniciar sesión.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Juan Pérez" {...field} />
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
                    <Input placeholder="nombre@ejemplo.com" {...field} />
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
                    <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
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
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repite tu contraseña" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/auth/login" className="font-medium underline">
            Inicia sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
