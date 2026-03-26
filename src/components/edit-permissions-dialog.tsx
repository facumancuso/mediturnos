
'use client';

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
    DialogDescription 
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import type { TeamMember } from '@/types';

const permissionsSchema = z.object({
  role: z.custom<TeamMember['role']>(val => ['Profesional', 'Secretaria'].includes(val as string), {
     message: 'Debes seleccionar un rol válido.'
  }),
});

type EditPermissionsDialogProps = {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleChange: (memberId: string, newRole: TeamMember['role']) => void;
};

export function EditPermissionsDialog({ member, open, onOpenChange, onRoleChange }: EditPermissionsDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof permissionsSchema>>({
    resolver: zodResolver(permissionsSchema),
  });

  useEffect(() => {
    if (member) {
      form.reset({
        role: member.role,
      });
    }
  }, [member, open, form]);

  if (!member) return null;

  function onSubmit(values: z.infer<typeof permissionsSchema>) {
    if (member) {
      onRoleChange(member.id, values.role);
      toast({
        title: 'Permisos actualizados',
        description: `El rol de ${member.name} ha sido cambiado a ${values.role}.`,
      });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Permisos de {member.name}</DialogTitle>
          <DialogDescription>
            {member.email}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol en la Organización</FormLabel>
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
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
