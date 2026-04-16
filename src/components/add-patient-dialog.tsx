'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/types';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

const patientFormSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  dni: z.string().regex(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos.' }),
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  phone: z.string().min(8, { message: 'Por favor, introduce un teléfono válido.' }),
});

type AddPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientAdded?: (newPatient: Patient) => void;
};

export function AddPatientDialog({ open, onOpenChange, onPatientAdded }: AddPatientDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof patientFormSchema>>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { name: '', dni: '', email: '', phone: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  async function onSubmit(values: z.infer<typeof patientFormSchema>) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el paciente. Por favor, inicia sesión.',
      });
      return;
    }

    const newPatient: Omit<Patient, 'createdAt' | 'updatedAt'> = {
      id: values.dni,
      professionalId: user.uid,
      dni: values.dni.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3'),
      name: values.name,
      email: values.email,
      phone: values.phone,
      insurance: 'Particular',
      lastVisit: new Date().toISOString(),
      totalVisits: 0,
      missedAppointments: 0,
      avatarUrl: `https://picsum.photos/seed/${values.dni}/100/100`,
    };
    
    try {
      setIsSubmitting(true);
      const response = await fetchWithAuth('/api/dashboard/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPatient),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Error ${response.status}`);
      }

      const savedPatient = (await response.json()) as Patient;
      onPatientAdded?.(savedPatient);

      toast({
        title: '¡Paciente Creado!',
        description: `${newPatient.name} ha sido agregado a la lista de pacientes.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el paciente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Paciente</DialogTitle>
          <DialogDescription>
            Completa los datos del nuevo paciente. Se agregará a tu lista y quedará seleccionado.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre y Apellido</FormLabel>
                  <FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dni"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DNI (sin puntos)</FormLabel>
                  <FormControl><Input placeholder="12345678" {...field} /></FormControl>
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
                  <FormControl><Input placeholder="juan.perez@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl><Input placeholder="+54 9 11 1234-5678" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Agregar Paciente'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
