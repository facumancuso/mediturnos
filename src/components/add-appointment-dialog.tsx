'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AddPatientDialog } from './add-patient-dialog';
import type { Patient } from '@/types';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

const appointmentFormSchema = z.object({
  patientId: z.string({ required_error: 'Por favor, selecciona un paciente.' }).min(1, { message: 'Por favor, selecciona un paciente.' }),
  date: z.date({ required_error: 'Por favor, selecciona una fecha.' }),
  time: z.string().min(1, { message: 'La hora es obligatoria.' }),
  duration: z.coerce.number().min(1, { message: 'La duración es obligatoria.' }),
  type: z.enum(['first_time', 'checkup', 'urgent'], { required_error: 'El tipo de turno es obligatorio.' }),
});

type AddAppointmentDialogProps = {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultPatientId?: string;
  defaultDate?: Date;
  defaultTime?: string;
  onAppointmentCreated?: () => void;
};

export function AddAppointmentDialog({ children, open, onOpenChange, defaultPatientId, defaultDate, defaultTime, onAppointmentCreated }: AddAppointmentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const { user } = useUser();

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const professionalId = user?.uid;
    if (!isOpen || !professionalId) return;

    let cancelled = false;

    async function loadPatients() {
      try {
        setIsLoadingPatients(true);
        const response = await fetchWithAuth(`/api/dashboard/patients?professionalId=${professionalId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los pacientes.');
        }

        const data = (await response.json()) as Patient[];
        if (!cancelled) {
          setPatients(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPatients([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPatients(false);
        }
      }
    }

    loadPatients();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.uid]);

  const form = useForm<z.infer<typeof appointmentFormSchema>>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
        patientId: '',
        duration: 30,
        type: 'checkup',
    }
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset({
            duration: 30,
            type: 'checkup',
            patientId: defaultPatientId || '',
            date: defaultDate || new Date(),
            time: defaultTime || '',
        });
    }
  }, [isOpen, defaultPatientId, defaultDate, defaultTime, form]);

  async function onSubmit(values: z.infer<typeof appointmentFormSchema>) {
    if (!user || !patients) return;

    const selectedPatient = patients.find(p => p.id === values.patientId);
    if (!selectedPatient) return;

    const appointmentDateTime = new Date(values.date);
    const [hours, minutes] = values.time.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes);

    try {
      setIsSubmitting(true);
      const response = await fetchWithAuth('/api/dashboard/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId: user.uid,
          patientId: values.patientId,
          patientName: selectedPatient.name,
          patientAvatarUrl: selectedPatient.avatarUrl || '',
          date: appointmentDateTime.toISOString(),
          time: values.time,
          duration: values.duration,
          type: values.type,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo crear el turno.');
      }

      toast({
        title: '¡Turno agendado!',
        description: `Se ha agendado un nuevo turno para ${selectedPatient.name}.`,
      });
      onAppointmentCreated?.();
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo agendar el turno en MongoDB local.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePatientAdded = (newPatient: Patient) => {
    setPatients((prev) => {
      const withoutDuplicated = prev.filter((patient) => patient.id !== newPatient.id);
      return [newPatient, ...withoutDuplicated];
    });
    form.setValue('patientId', newPatient.id);
  };

  const dialogContent = (
    <>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Agendar Nuevo Turno</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="patientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <div className="flex items-center gap-2">
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger disabled={isLoadingPatients}>
                        <SelectValue placeholder="Selecciona un paciente" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {patients?.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                            {patient.name} ({patient.dni})
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddingPatient(true)}>
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only">Agregar Nuevo Paciente</span>
                    </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                      >
                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duración</FormLabel>
                 <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                  <FormControl>
                     <SelectTrigger>
                        <SelectValue placeholder="Seleccionar duración" />
                    </SelectTrigger>
                  </FormControl>
                   <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Turno</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo de turno" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="checkup">Control</SelectItem>
                    <SelectItem value="first_time">Primera Vez</SelectItem>
                    <SelectItem value="urgent">Urgencia</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Agendar Turno'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>

    <AddPatientDialog 
        open={isAddingPatient}
        onOpenChange={setIsAddingPatient}
        onPatientAdded={handlePatientAdded}
    />
    </>
  );
  
  if (children) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return <Dialog open={isOpen} onOpenChange={setIsOpen}>{dialogContent}</Dialog>;
}
