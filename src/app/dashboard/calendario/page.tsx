'use client';

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import type { Appointment, Professional } from "@/types";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar as CalendarIcon } from "lucide-react";
import { AddAppointmentDialog } from "@/components/add-appointment-dialog";
import { AppointmentDetailsDialog } from "@/components/appointment-details-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/firebase";
import { fetchWithAuth } from '@/lib/fetch-with-auth';

const statusStyles: { [key in Appointment['status']]: string } = {
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const statusLabels: { [key in Appointment['status']]: string } = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    completed: 'Completado',
    cancelled: 'Cancelado',
    no_show: 'No asistió',
};

function formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function generateTimeSlots(
  startTimeStr: string,
  endTimeStr: string,
  duration: number,
  breaks: { start: string; end: string }[] = []
): string[] {
  const slots: string[] = [];
  const start = new Date(`1970-01-01T${startTimeStr}:00`);
  const end = new Date(`1970-01-01T${endTimeStr}:00`);

  let current = new Date(start);

  while (current < end) {
    const inBreak = breaks.some(breakPeriod => {
      const breakStart = new Date(`1970-01-01T${breakPeriod.start}:00`);
      const breakEnd = new Date(`1970-01-01T${breakPeriod.end}:00`);
      return current >= breakStart && current < breakEnd;
    });

    if (!inBreak) {
      slots.push(formatTime(current));
    }

    current.setMinutes(current.getMinutes() + duration);
  }
  return slots;
}

export default function CalendarPage() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isAddAppointmentDialogOpen, setIsAddAppointmentDialogOpen] = useState(false);
    const [selectedTimeForNewAppointment, setSelectedTimeForNewAppointment] = useState<string | undefined>();
    const [isClient, setIsClient] = useState(false);
    const [appointmentsReloadKey, setAppointmentsReloadKey] = useState(0);
        const [professional, setProfessional] = useState<Professional | null>(null);
        const [appointmentsOnDay, setAppointmentsOnDay] = useState<Appointment[]>([]);
        const [isLoadingProfessional, setIsLoadingProfessional] = useState(false);
        const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

    const { user, isUserLoading } = useUser();

        useEffect(() => {
            const professionalId = user?.uid;
            if (!professionalId) {
                setProfessional(null);
                return;
            }

            let cancelled = false;

            async function loadProfessional() {
                try {
                    setIsLoadingProfessional(true);
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
        }, [user?.uid]);

        useEffect(() => {
            const professionalId = user?.uid;
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
                    const response = await fetchWithAuth(`/api/dashboard/appointments?professionalId=${professionalId}&day=${selectedDay}`, { cache: 'no-store' });
                    if (!response.ok) {
                        throw new Error('No se pudieron cargar los turnos.');
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
        }, [user?.uid, date, appointmentsReloadKey]);

    const openAddAppointmentDialog = (time?: string) => {
        setSelectedTimeForNewAppointment(time);
        setIsAddAppointmentDialogOpen(true);
    };

    useEffect(() => {
        setIsClient(true);
    }, []);

    const timeSlotsForSelectedDay = useMemo(() => {
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

        return allSlots.map(slotTime => {
            const appointmentInSlot = appointmentsOnDay.find(appt => appt.time === slotTime);
            if (appointmentInSlot) {
                return {
                    time: slotTime,
                    status: 'Ocupado' as const,
                    appointment: appointmentInSlot,
                };
            } else {
                return {
                    time: slotTime,
                    status: 'Libre' as const,
                    appointment: null,
                };
            }
        });

    }, [date, professional, appointmentsOnDay]);
    
    const isLoading = isUserLoading || isLoadingProfessional || isLoadingAppointments;

    return (
        <div className="flex flex-col gap-4 h-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Calendario</h1>
                    <p className="text-muted-foreground">Visualiza y gestiona tus turnos.</p>
                </div>
                 <Button onClick={() => openAddAppointmentDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Agendar Turno
                </Button>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                <Card className="lg:col-span-1">
                     <CardContent className="p-1 flex justify-center">
                        {isClient ? (
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                locale={es}
                                weekStartsOn={1}
                                className="rounded-md border"
                            />
                        ) : (
                            <div className="p-3"><Skeleton className="h-[298px] w-full max-w-[320px] mx-auto rounded-md" /></div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="capitalize">
                            {isClient && date ? `Turnos para el ${format(date, "eeee d 'de' MMMM", { locale: es })}` : "Cargando..."}
                        </CardTitle>
                        <CardDescription>
                            Mostrando todos los horarios disponibles y ocupados del día.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ScrollArea className="h-[60vh] pr-4">
                             {isLoading ? (
                                <div className="space-y-2">
                                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                                </div>
                             ) : (
                                <div className="space-y-2">
                                    {timeSlotsForSelectedDay.length > 0 ? (
                                        timeSlotsForSelectedDay.map(slot => (
                                            <div 
                                                key={slot.time} 
                                                className={cn(
                                                    "p-3 rounded-lg flex items-center justify-between transition-all",
                                                    slot.status === 'Ocupado' ? 'bg-muted cursor-pointer hover:shadow-md' : 'bg-background border border-dashed'
                                                )}
                                                onClick={() => slot.appointment && setSelectedAppointment(slot.appointment)}
                                            >
                                                <div className="font-semibold text-sm w-16 text-center">
                                                    <p>{slot.time}</p>
                                                </div>

                                                {slot.status === 'Ocupado' && slot.appointment ? (
                                                    <>
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <Avatar className="h-10 w-10">
                                                                <AvatarImage src={slot.appointment.patientAvatarUrl} alt={slot.appointment.patientName} />
                                                                <AvatarFallback>{slot.appointment.patientName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-semibold">{slot.appointment.patientName}</p>
                                                                <p className="text-sm text-muted-foreground capitalize">{slot.appointment.type === 'checkup' ? 'Control' : slot.appointment.type === 'first_time' ? 'Primera Vez' : 'Urgencia'}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className={cn(statusStyles[slot.appointment.status], 'border-none')}>{statusLabels[slot.appointment.status]}</Badge>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 text-sm text-green-600 font-medium">
                                                            <span>Libre</span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAddAppointmentDialog(slot.time);
                                                            }}
                                                        >
                                                            <PlusCircle className="mr-2 h-4 w-4" />
                                                            Agendar
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground h-full">
                                            <CalendarIcon className="h-12 w-12 mb-4" />
                                            <h3 className="text-lg font-semibold">No hay turnos para este día</h3>
                                            <p className="mt-1 text-sm">Ajusta tus horarios de atención en la configuración.</p>
                                        </div>
                                    )}
                                </div>
                             )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <AddAppointmentDialog 
                open={isAddAppointmentDialogOpen}
                onOpenChange={setIsAddAppointmentDialogOpen}
                defaultDate={date}
                defaultTime={selectedTimeForNewAppointment}
                onAppointmentCreated={() => setAppointmentsReloadKey((current) => current + 1)}
            />

            <AppointmentDetailsDialog 
                appointment={selectedAppointment}
                open={!!selectedAppointment}
                onOpenChange={(isOpen) => !isOpen && setSelectedAppointment(null)}
            />
        </div>
    );
}
