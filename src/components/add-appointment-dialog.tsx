'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getWorkingHoursForDate } from '@/lib/working-hours';
import { AddPatientDialog } from './add-patient-dialog';
import type { Appointment, Patient, Professional } from '@/types';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function generateTimeSlots(
  startTime: string,
  endTime: string,
  stepMinutes: number,
  appointmentDuration: number,
  breaks: { start: string; end: string }[] = []
) {
  const slots: string[] = [];
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);

  for (let current = startMinutes; current + appointmentDuration <= endMinutes; current += stepMinutes) {
    const isInBreak = breaks.some((breakPeriod) => {
      const breakStart = timeStringToMinutes(breakPeriod.start);
      const breakEnd = timeStringToMinutes(breakPeriod.end);
      return current < breakEnd && current + appointmentDuration > breakStart;
    });

    if (isInBreak) {
      continue;
    }

    const hours = String(Math.floor(current / 60)).padStart(2, '0');
    const minutes = String(current % 60).padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
  }

  return slots;
}

function isSlotOverlapping(slot: string, duration: number, appointments: Appointment[]) {
  const slotStart = timeStringToMinutes(slot);
  const slotEnd = slotStart + duration;

  return appointments.some((appointment) => {
    const appointmentStart = timeStringToMinutes(appointment.time);
    const appointmentEnd = appointmentStart + (appointment.duration || duration);
    return slotStart < appointmentEnd && slotEnd > appointmentStart;
  });
}

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
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointmentsOnDay, setAppointmentsOnDay] = useState<Appointment[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const patientPickerRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const professionalId = user?.uid;
    if (!isOpen || !professionalId) return;

    let cancelled = false;

    async function loadProfessional() {
      try {
        const response = await fetchWithAuth(`/api/dashboard/professional?professionalId=${professionalId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('No se pudo cargar el profesional.');
        }

        const data = (await response.json()) as Professional;
        if (!cancelled) {
          setProfessional(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setProfessional(null);
        }
      }
    }

    loadProfessional();

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
        setPatientSearch('');
      setIsPatientPickerOpen(false);
        form.reset({
            duration: 30,
            type: 'checkup',
            patientId: defaultPatientId || '',
            date: defaultDate || new Date(),
            time: defaultTime || '',
        });
    }
  }, [isOpen, defaultPatientId, defaultDate, defaultTime, form]);

  const selectedDate = form.watch('date');
  const selectedDuration = form.watch('duration') || 30;

  useEffect(() => {
    const professionalId = user?.uid;
    if (!isOpen || !professionalId || !selectedDate) {
      setAppointmentsOnDay([]);
      return;
    }

    let cancelled = false;
    const day = format(selectedDate, 'yyyy-MM-dd');

    async function loadAppointmentsOnDay() {
      try {
        setIsLoadingAvailability(true);
        const response = await fetchWithAuth(
          `/api/dashboard/appointments?professionalId=${professionalId}&day=${day}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('No se pudieron cargar los turnos del día.');
        }

        const data = (await response.json()) as Appointment[];
        if (!cancelled) {
          setAppointmentsOnDay(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAppointmentsOnDay([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAvailability(false);
        }
      }
    }

    loadAppointmentsOnDay();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.uid, selectedDate]);

  useEffect(() => {
    if (!isPatientPickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!patientPickerRef.current?.contains(event.target as Node)) {
        setIsPatientPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isPatientPickerOpen]);

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
    setPatientSearch('');
  };

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) {
      return patients;
    }

    return patients.filter((patient) =>
      patient.name.toLowerCase().includes(query) ||
      patient.dni.toLowerCase().includes(query)
    );
  }, [patients, patientSearch]);

  const blockedDateSet = useMemo(
    () => new Set(Array.isArray(professional?.blockedDates) ? professional.blockedDates : []),
    [professional?.blockedDates]
  );

  const isSelectedDayBlocked = useMemo(() => {
    if (!selectedDate) return false;
    return blockedDateSet.has(format(selectedDate, 'yyyy-MM-dd'));
  }, [selectedDate, blockedDateSet]);

  const availableSlots = useMemo(() => {
    if (!selectedDate || !professional || isSelectedDayBlocked) {
      return [];
    }

    const workingHours = getWorkingHoursForDate(
      professional.workingHours,
      selectedDate,
      professional.appointmentDuration || 30
    );

    if (!workingHours.enabled) {
      return [];
    }

    const slotStep = professional.appointmentDuration || 30;
    const allSlots = generateTimeSlots(
      workingHours.start,
      workingHours.end,
      slotStep,
      selectedDuration,
      workingHours.breaks
    );

    const activeAppointments = appointmentsOnDay.filter((appointment) => appointment.status !== 'cancelled');
    return allSlots.filter((slot) => !isSlotOverlapping(slot, selectedDuration, activeAppointments));
  }, [selectedDate, professional, isSelectedDayBlocked, appointmentsOnDay, selectedDuration]);

  useEffect(() => {
    if (!selectedDate) return;
    const currentTime = form.getValues('time');
    if (currentTime && !availableSlots.includes(currentTime)) {
      form.setValue('time', '');
    }
  }, [availableSlots, form, selectedDate]);

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
                {(() => {
                  const selectedPatient = patients.find((patient) => patient.id === field.value) || null;
                  return (
                <>
                <FormLabel>Paciente</FormLabel>
                <div className="flex items-start gap-2">
                    <div ref={patientPickerRef} className="relative flex-1">
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'w-full justify-between font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          disabled={isLoadingPatients}
                          onClick={() => setIsPatientPickerOpen((current) => !current)}
                        >
                          <span className="truncate">
                            {selectedPatient ? `${selectedPatient.name} (${selectedPatient.dni})` : 'Selecciona un paciente'}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>

                      {isPatientPickerOpen && (
                        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border/50 bg-popover shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                          <div className="border-b border-border/40 p-3">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                autoFocus
                                value={patientSearch}
                                onChange={(event) => setPatientSearch(event.target.value)}
                                placeholder="Buscar por nombre o DNI"
                                className="pl-9"
                              />
                            </div>
                          </div>
                          <ScrollArea className="h-64">
                            <div className="p-2">
                              {filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                                <button
                                  key={patient.id}
                                  type="button"
                                  onClick={() => {
                                    field.onChange(patient.id);
                                    setPatientSearch('');
                                    setIsPatientPickerOpen(false);
                                  }}
                                  className={cn(
                                    'flex w-full items-start rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                                    field.value === patient.id && 'bg-accent text-accent-foreground'
                                  )}
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{patient.name}</p>
                                    <p className="text-xs text-muted-foreground">DNI: {patient.dni}</p>
                                  </div>
                                </button>
                              )) : (
                                <div className="px-3 py-3 text-sm text-muted-foreground">
                                  No se encontraron pacientes.
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsAddingPatient(true)}>
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only">Agregar Nuevo Paciente</span>
                    </Button>
                </div>
                <FormMessage />
                </>
                  );
                })()}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      const nextDate = new Date(`${value}T12:00:00`);
                      field.onChange(nextDate);
                    }}
                  />
                </FormControl>
                {field.value && (
                  <p className="text-xs text-muted-foreground">
                    {format(field.value, 'PPP', { locale: es })}
                  </p>
                )}
                {isSelectedDayBlocked && (
                  <p className="text-xs text-destructive">Ese día está bloqueado en la configuración del profesional.</p>
                )}
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
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAvailability || availableSlots.length === 0}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingAvailability ? 'Cargando horarios...' : 'Selecciona un horario disponible'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoadingAvailability && !isSelectedDayBlocked && availableSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay horarios disponibles para esa fecha.</p>
                )}
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
