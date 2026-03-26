'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import type { TeamMember } from '@/types';

const addMemberSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un email válido.' }),
  role: z.custom<TeamMember['role']>(val => ['Profesional', 'Secretaria'].includes(val as string), {
     message: 'Debes seleccionar un rol válido.'
  }),
});

type AddTeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddTeamMemberDialog({ open, onOpenChange }: AddTeamMemberDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof addMemberSchema>>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      role: 'Secretaria',
    },
  });

  useEffect(() => {
    form.reset();
  }, [open, form]);

  function onSubmit(values: z.infer<typeof addMemberSchema>) {
    console.log('Invitando nuevo miembro:', values);
    toast({
      title: '¡Invitación Enviada!',
      description: `Se ha enviado una invitación a ${values.email} para unirse como ${values.role}.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Miembro al Equipo</DialogTitle>
          <DialogDescription>
            Ingresa el email y asigna un rol. La persona recibirá una invitación para unirse a tu organización.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email del miembro</FormLabel>
                  <FormControl>
                    <Input placeholder="nombre@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Profesional">Profesional</SelectItem>
                      <SelectItem value="Secretaria">Secretaria</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
              <Button type="submit">Enviar Invitación</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
