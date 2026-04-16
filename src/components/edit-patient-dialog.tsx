'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/types';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

const schema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  email: z.string().email('Email inválido.').or(z.literal('')),
  phone: z.string().min(6, 'Teléfono inválido.'),
  insurance: z.string().min(1, 'Ingresá la obra social o "Particular".'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type EditPatientDialogProps = {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientUpdated?: (updated: Patient) => void;
};

export function EditPatientDialog({ patient, open, onOpenChange, onPatientUpdated }: EditPatientDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', insurance: '', notes: '' },
  });

  useEffect(() => {
    if (patient && open) {
      form.reset({
        name: patient.name ?? '',
        email: patient.email ?? '',
        phone: patient.phone ?? '',
        insurance: patient.insurance ?? 'Particular',
        notes: patient.notes ?? '',
      });
    }
  }, [patient, open, form]);

  async function onSubmit(values: FormValues) {
    if (!user || !patient) return;
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/dashboard/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: user.uid,
          id: patient.id,
          ...values,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Error ${res.status}`);
      }

      const updated = (await res.json()) as Patient;
      onPatientUpdated?.(updated);
      toast({ title: 'Paciente actualizado', description: `Los datos de ${updated.name} fueron guardados.` });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el paciente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!patient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
          <DialogDescription>
            Modificá los datos de {patient.name}. El DNI no puede cambiarse.
          </DialogDescription>
        </DialogHeader>

        {/* DNI read-only */}
        <div className="px-1 py-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">DNI</p>
          <p className="text-sm font-semibold text-muted-foreground bg-muted rounded-md px-3 py-2">
            {patient.dni}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="juan@example.com" type="email" {...field} /></FormControl>
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
            <FormField
              control={form.control}
              name="insurance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra Social / Prepaga</FormLabel>
                  <FormControl><Input placeholder="OSDE, Swiss Medical, Particular..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Alergias, condiciones relevantes, observaciones generales..."
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
