'use client';

import { useState, useMemo, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, Mail, Smartphone, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Appointment, Professional } from '@/types';

// Form Schema
const formSchema = z.object({
  name: z.string().min(3, 'El nombre es requerido.'),
  dni: z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos.'),
  email: z.string().email('Por favor, introduce un email válido.'),
  phone: z.string().min(8, 'Por favor, introduce un teléfono válido.'),
});

// Time slot generation logic (simplified)
function generateTimeSlots(startTimeStr: string, endTimeStr: string, duration: number, breaks: { start: string; end: string }[] = []) {
  const slots: string[] = [];
  const start = new Date(`1970-01-01T${startTimeStr}:00`);
  const end = new Date(`1970-01-01T${endTimeStr}:00`);
  const current = new Date(start);
  while (current < end) {
    const inBreak = breaks.some((breakPeriod) => {
      const breakStart = new Date(`1970-01-01T${breakPeriod.start}:00`);
      const breakEnd = new Date(`1970-01-01T${breakPeriod.end}:00`);
      return current >= breakStart && current < breakEnd;
    });

    if (!inBreak) {
      slots.push(format(current, 'HH:mm'));
    }

    current.setMinutes(current.getMinutes() + duration);
  }
  return slots;
}

function getAppointmentDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export default function BookAppointmentPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { toast } = useToast();

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointmentsOnDay, setAppointmentsOnDay] = useState<Appointment[]>([]);
  const [isLoadingProfessional, setIsLoadingProfessional] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadProfessional() {
      try {
        setIsLoadingProfessional(true);
        const response = await fetch(`/api/professionals/${slug}`, { cache: 'no-store' });
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
      } finally {
        if (!cancelled) {
          setIsLoadingProfessional(false);
        }
      }
    }

    loadProfessional();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const professionalId = professional?.id || professional?.userId;
    const selectedDate = date;
    if (!professionalId || !selectedDate) {
      setAppointmentsOnDay([]);
      return;
    }

    const selectedDay = format(selectedDate, 'yyyy-MM-dd');
    let cancelled = false;

    async function loadAppointments() {
      try {
        setIsLoadingAppointments(true);
        const response = await fetch(
          `/api/dashboard/appointments?professionalId=${professionalId}&day=${selectedDay}`,
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
          setIsLoadingAppointments(false);
        }
      }
    }

    loadAppointments();

    return () => {
      cancelled = true;
    };
  }, [professional?.id, professional?.userId, date]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', dni: '', email: '', phone: '' },
  });

  const availableSlots = useMemo(() => {
    if (!date || !professional) return [];

    const workingHoursConfig = professional.workingHours ? JSON.parse(professional.workingHours) : {};
    const workingHours = {
      start: workingHoursConfig.start || '09:00',
      end: workingHoursConfig.end || '18:00',
      breaks: workingHoursConfig.breaks || [{ start: '13:00', end: '14:00' }],
      appointmentDuration: professional.appointmentDuration || 30,
    };

    const allSlots = generateTimeSlots(
      workingHours.start,
      workingHours.end,
      workingHours.appointmentDuration,
      workingHours.breaks
    );

    const bookedSlots = appointmentsOnDay
      .filter((appointment) => appointment.status !== 'cancelled')
      .map((appointment) => appointment.time);

    return allSlots.filter(slot => !bookedSlots.includes(slot));
  }, [date, professional, appointmentsOnDay]);

  if (!isLoadingProfessional && !professional) {
    notFound();
  }
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("Appointment Data:", {
      professional: professional.name,
      date,
      time: selectedTime,
      patient: values,
    });
    setStep(3); // Move to confirmation step
  };
  
  const handleFinalConfirmation = async () => {
    const professionalId = professional?.id || professional?.userId;
    if (!professionalId || !date || !selectedTime || !professional) {
      return;
    }

    try {
      setIsSubmitting(true);

      const appointmentDate = new Date(date);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      appointmentDate.setHours(hours, minutes, 0, 0);

      const response = await fetch('/api/dashboard/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalId,
          patientId: `public-${form.getValues('dni')}`,
          patientName: form.getValues('name'),
          patientAvatarUrl: '',
          date: appointmentDate.toISOString(),
          time: selectedTime,
          duration: professional.appointmentDuration || 30,
          type: 'first_time',
          status: 'pending',
          notes: `Solicitud pública desde perfil ${professional.publicProfile?.slug || slug}`,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo registrar la solicitud de turno.');
      }

      toast({
          title: '¡Turno agendado con éxito!',
          description: `Recibirás un email de confirmación en ${form.getValues('email')}.`,
      });
      setStep(4);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al agendar',
        description: 'No se pudo generar la solicitud de turno. Intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const renderStep = () => {
    switch (step) {
      case 1: // Select Date & Time
        return (
          <>
            <CardHeader>
              <CardTitle>Selecciona Fecha y Hora</CardTitle>
              <CardDescription>Elige un horario disponible para tu turno.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex justify-center">
                {isClient ? (
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={es}
                    weekStartsOn={1}
                    disabled={(day) => day < startOfDay(new Date())}
                    initialFocus
                  />
                ) : <Skeleton className="h-[298px] w-full max-w-[320px] rounded-md" />}
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold mb-4 text-center">
                  Horarios para {date ? format(date, "PPP", { locale: es }) : '...'}
                </h3>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-72 pr-2">
                  {isLoadingAppointments ? (
                    [...Array(9)].map((_, index) => <Skeleton key={index} className="h-9 w-full" />)
                  ) : availableSlots.length > 0 ? (
                    availableSlots.map(time => (
                      <Button
                        key={time}
                        variant="outline"
                        onClick={() => {
                          setSelectedTime(time);
                          setStep(2);
                        }}
                      >
                        {time}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-muted-foreground mt-4">No hay turnos disponibles para este día.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </>
        );
      case 2: // Patient Details
        return (
          <>
             <CardHeader>
               <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="self-start -ml-2 mb-2">
                 <ArrowLeft className="mr-2 h-4 w-4" /> Volver a horarios
               </Button>
              <CardTitle>Completa tus datos</CardTitle>
              <CardDescription>Estás a un paso de agendar tu turno para el <span className="font-bold">{date ? format(date, "PPP", { locale: es }) : ''} a las {selectedTime} hs</span>.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre y Apellido</FormLabel>
                      <FormControl><Input placeholder="Tu nombre completo" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                   <FormField control={form.control} name="dni" render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
                      <FormControl><Input placeholder="Tu DNI sin puntos" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input placeholder="tu@email.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                   <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl><Input placeholder="Tu número de teléfono" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <Button type="submit" className="w-full">
                    Confirmar Datos <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        );
      case 3: // Confirmation
        return (
            <>
                <CardHeader>
                    <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="self-start -ml-2 mb-2">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Editar datos
                    </Button>
                    <CardTitle>Confirma tu turno</CardTitle>
                    <CardDescription>Revisa los datos antes de finalizar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center gap-3"><CalendarIcon className="h-5 w-5 text-primary" /> <div><p className="font-bold">{date ? format(date, "eeee dd 'de' MMMM", { locale: es }) : ''}</p><p className="text-sm text-muted-foreground">Fecha del turno</p></div></div>
                        <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /> <div><p className="font-bold">{selectedTime} hs</p><p className="text-sm text-muted-foreground">Hora</p></div></div>
                    </div>
                     <div className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center gap-3"><User className="h-5 w-5 text-primary" /> <div><p className="font-bold">{form.getValues('name')}</p><p className="text-sm text-muted-foreground">Paciente</p></div></div>
                        <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" /> <div><p className="font-bold">{form.getValues('email')}</p><p className="text-sm text-muted-foreground">Email de contacto</p></div></div>
                        <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-primary" /> <div><p className="font-bold">{form.getValues('phone')}</p><p className="text-sm text-muted-foreground">Teléfono de contacto</p></div></div>
                    </div>
                    <Button onClick={handleFinalConfirmation} className="w-full" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? 'Agendando...' : 'Agendar Turno Definitivamente'}
                    </Button>
                </CardContent>
            </>
        );
    case 4: // Success
        return (
             <CardContent className="flex flex-col items-center justify-center text-center py-16">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">¡Turno Agendado!</h2>
                <p className="text-muted-foreground max-w-sm">
                    Tu turno con {professional.name} para el {date ? format(date, "PPP", { locale: es }) : ''} a las {selectedTime} hs ha sido confirmado.
                    Recibirás los detalles en tu correo.
                </p>
                 <Button asChild className="mt-8">
                    <a href="/">Volver al inicio</a>
                 </Button>
            </CardContent>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-12">
        {isLoadingProfessional ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        ) : (
          <>
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
            <Avatar className="h-20 w-20 border">
              <AvatarImage src={professional?.photoURL || ''} alt={professional?.name || 'Profesional'} />
              <AvatarFallback>{professional.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Estás agendando un turno con</p>
              <h1 className="text-3xl font-bold">{professional.name}</h1>
              <p className="text-lg text-primary">{professional.specialty}</p>
            </div>
        </div>

        <Card>
            {renderStep()}
        </Card>
          </>
        )}
    </div>
  );
}
