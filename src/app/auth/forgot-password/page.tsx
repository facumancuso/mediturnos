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
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
});

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const auth = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await sendPasswordResetEmail(auth, values.email);
      setSubmitted(true);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el email de recuperación. Por favor, verifica el email e inténtalo de nuevo.',
      });
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Recuperar Contraseña</CardTitle>
        <CardDescription>
          {submitted
            ? 'Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.'
            : 'Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!submitted ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="text-center">
            <p className="text-muted-foreground">Revisa tu bandeja de entrada (y la carpeta de spam).</p>
          </div>
        )}
        <div className="mt-4 text-center text-sm">
          <Link href="/auth/login" className="font-medium underline">
            Volver a Iniciar Sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
