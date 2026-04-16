'use client';

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect, useRef, type ComponentProps } from "react";
import type { Appointment, Professional } from "@/types";
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar as CalendarIcon, CheckCircle2, MessageCircle, Bell, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isToday, isTomorrow } from 'date-fns';
import { AddAppointmentDialog } from "@/components/add-appointment-dialog";
import { AppointmentDetailsDialog } from "@/components/appointment-details-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/firebase";
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { getWorkingHoursForDate } from '@/lib/working-hours';
import { DayButton as DayPickerDayButton } from 'react-day-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter, useSearchParams } from 'next/navigation';

function CalendarDayButtonWithAppointmentDot(
    props: ComponentProps<typeof DayPickerDayButton>,
) {
    const hasAppt = Boolean(props.modifiers.hasAppointment);
    return (
        <DayPickerDayButton
            {...props}
            className={cn(props.className, hasAppt && 'relative pb-1')}
        >
            {props.children}
            {hasAppt ? (
                <span
                    className="pointer-events-none absolute bottom-0.5 left-1/2 z-[1] h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                    aria-hidden
                />
            ) : null}
        </DayPickerDayButton>
    );
}

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

function isPatientAttendanceConfirmed(appointment: Appointment) {
    const responseValue = String(appointment.patientResponse || '').toLowerCase();
    return (
        appointment.status === 'confirmed' &&
        (responseValue === 'confirmed' || (Boolean(appointment.patientRespondedAt) && responseValue !== 'declined'))
    );
}

function isPatientAttendanceDeclined(appointment: Appointment) {
    return String(appointment.patientResponse || '').toLowerCase() === 'declined';
}

function getAppointmentBadge(appointment: Appointment) {
    const patientDeclined = isPatientAttendanceDeclined(appointment);
    const patientConfirmed = isPatientAttendanceConfirmed(appointment);

    if (patientDeclined) {
        return {
            className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
            label: 'No asistirá',
        };
    }

    if (patientConfirmed) {
        return {
            className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
            label: 'Confirmado por paciente',
        };
    }

    return {
        className: statusStyles[appointment.status],
        label: statusLabels[appointment.status],
    };
}

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

/** Clave yyyy-MM-dd en hora local para coincidir con el calendario. */
function localDayKey(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

export default function CalendarPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
    const [appointmentDayKeys, setAppointmentDayKeys] = useState<Set<string>>(() => new Set());
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isAddAppointmentDialogOpen, setIsAddAppointmentDialogOpen] = useState(false);
    const [selectedTimeForNewAppointment, setSelectedTimeForNewAppointment] = useState<string | undefined>();
    const [isClient, setIsClient] = useState(false);
    const [appointmentsReloadKey, setAppointmentsReloadKey] = useState(0);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const { toast } = useToast();
    const [professional, setProfessional] = useState<Professional | null>(null);
    const [appointmentsOnDay, setAppointmentsOnDay] = useState<Appointment[]>([]);
    const [isLoadingProfessional, setIsLoadingProfessional] = useState(false);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

    // Drag & drop
    const [draggingAppointment, setDraggingAppointment] = useState<Appointment | null>(null);
    const [dropTargetTime, setDropTargetTime] = useState<string | null>(null);
    const [dragConfirm, setDragConfirm] = useState<{ appointment: Appointment; newTime: string } | null>(null);
    const [patientConfirmedOnDrop, setPatientConfirmedOnDrop] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const draggingRef = useRef<Appointment | null>(null);
    const pendingDeepLinkAppointmentIdRef = useRef<string | null>(null);
    const resolvedDeepLinkAppointmentIdRef = useRef<string | null>(null);
    // Touch drag
    const [touchGhostPos, setTouchGhostPos] = useState<{ x: number; y: number } | null>(null);
    const dropTargetTimeRef = useRef<string | null>(null);

    const { user, isUserLoading } = useUser();

    // Global dragend safety net — cleans up if the browser fires dragend
    // outside of any slot's onDragEnd (e.g. dropped outside, ESC key, etc.)
    useEffect(() => {
        const cleanup = () => {
            if (!draggingRef.current) return;
            draggingRef.current = null;
            setDraggingAppointment(null);
            setDropTargetTime(null);
        };
        document.addEventListener('dragend', cleanup);
        return () => document.removeEventListener('dragend', cleanup);
    }, []);

    // Prevent page scroll while touch-dragging (must be non-passive)
    useEffect(() => {
        const preventScroll = (e: TouchEvent) => {
            if (draggingRef.current) e.preventDefault();
        };
        document.addEventListener('touchmove', preventScroll, { passive: false });
        return () => document.removeEventListener('touchmove', preventScroll);
    }, []);

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
                    const response = await fetchWithAuth(`/api/dashboard/professional?professionalId=${professionalId}`);

                    if (response.status === 404) {
                        const createResponse = await fetchWithAuth('/api/dashboard/professional', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: professionalId,
                                userId: professionalId,
                                name: user?.displayName || 'Profesional',
                                email: user?.email || '',
                            }),
                        });

                        if (!createResponse.ok) {
                            throw new Error('No se pudo crear el perfil profesional.');
                        }

                        const created = (await createResponse.json()) as Professional;
                        if (!cancelled) {
                            setProfessional(created);
                        }
                        return;
                    }

                    if (response.status === 403) {
                        if (!cancelled) {
                            setProfessional(null);
                        }
                        return;
                    }

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
        }, [user?.uid, user?.displayName, user?.email]);

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
                    const response = await fetchWithAuth(`/api/dashboard/appointments?professionalId=${professionalId}&day=${selectedDay}`);
                    if (!response.ok) {
                        throw new Error('No se pudieron cargar los turnos.');
                    }

                    const data = (await response.json()) as Appointment[];
                    if (!cancelled) {
                        setAppointmentsOnDay(data);
                        setSelectedAppointment((prev) => {
                            if (!prev) return prev;
                            const fresh = data.find((a) => a.id === prev.id);
                            return fresh ?? prev;
                        });
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

    useEffect(() => {
        const professionalId = user?.uid;
        if (!professionalId || !professional) {
            setAppointmentDayKeys(new Set());
            return;
        }

        let cancelled = false;
        const rangeStart = startOfMonth(visibleMonth);
        const rangeEnd = endOfMonth(visibleMonth);

        async function loadMonthAppointments() {
            try {
                const response = await fetchWithAuth(
                    `/api/dashboard/appointments?professionalId=${professionalId}&start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`,
                );
                if (!response.ok) throw new Error('No se pudieron cargar los turnos del mes.');
                const data = (await response.json()) as Appointment[];
                if (cancelled) return;
                const keys = new Set<string>();
                for (const appt of data) {
                    if (appt.status === 'cancelled') continue;
                    const raw = appt.date as unknown;
                    const d = raw instanceof Date ? raw : new Date(String(raw));
                    if (!Number.isNaN(d.getTime())) {
                        keys.add(localDayKey(d));
                    }
                }
                setAppointmentDayKeys(keys);
            } catch (e) {
                console.error(e);
                if (!cancelled) setAppointmentDayKeys(new Set());
            }
        }

        void loadMonthAppointments();

        return () => {
            cancelled = true;
        };
    }, [user?.uid, professional, visibleMonth, appointmentsReloadKey]);

    async function handleAppointmentAction(appointmentId: string, action: 'confirm' | 'send_reminder') {
        setUpdatingId(appointmentId);
        try {
            const response = await fetchWithAuth(`/api/dashboard/appointments/${appointmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo actualizar el turno.' });
                return;
            }
            if (action === 'confirm' && data.whatsapp?.method === 'wame' && data.whatsapp?.url) {
                toast({
                    title: 'Turno confirmado ✅',
                    description: 'Podés avisar al paciente por WhatsApp.',
                    action: (
                        <a href={data.whatsapp.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                            <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
                        </a>
                    ),
                });
            } else if (action === 'send_reminder') {
                if (data.whatsapp?.method === 'wame' && data.whatsapp?.url) {
                    window.open(data.whatsapp.url, '_blank');
                } else {
                    toast({ title: 'Sin número de teléfono', description: 'El paciente no tiene teléfono registrado.', variant: 'destructive' });
                }
                return;
            }
            setAppointmentsReloadKey((k) => k + 1);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleReschedule(appointment: Appointment, newTime: string, patientConfirmed: boolean) {
        setIsRescheduling(true);
        try {
            const apptId = appointment.id || (appointment as any)._id?.toString() || '';
            const dateStr = format(new Date(appointment.date as unknown as string), 'yyyy-MM-dd');
            const body: Record<string, any> = {
                action: 'reschedule',
                date: dateStr,
                time: newTime,
                duration: appointment.duration,
            };
            if (patientConfirmed) {
                body.patientResponse = 'confirmed';
            }
            const response = await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo reprogramar el turno.' });
                return;
            }
            toast({ title: 'Turno movido', description: `Reprogramado a las ${newTime} hs.` });
            setDragConfirm(null);
            setPatientConfirmedOnDrop(false);
            setAppointmentsReloadKey((k) => k + 1);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
        } finally {
            setIsRescheduling(false);
        }
    }

    const openAddAppointmentDialog = (time?: string) => {
        setSelectedTimeForNewAppointment(time);
        setIsAddAppointmentDialogOpen(true);
    };

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        const appointmentIdFromQuery = searchParams.get('appointmentId');
        if (!appointmentIdFromQuery || resolvedDeepLinkAppointmentIdRef.current === appointmentIdFromQuery) {
            return;
        }

        let cancelled = false;

        async function resolveAppointmentFromQuery() {
            try {
                const response = await fetchWithAuth(`/api/patient/appointment/${appointmentIdFromQuery}`);

                if (!response.ok) {
                    throw new Error('No se pudo cargar el turno vinculado desde la notificación.');
                }

                const appointment = (await response.json()) as Appointment;
                const appointmentDate = new Date(appointment.date as unknown as string);

                if (cancelled || Number.isNaN(appointmentDate.getTime())) {
                    return;
                }

                pendingDeepLinkAppointmentIdRef.current = appointmentIdFromQuery;
                resolvedDeepLinkAppointmentIdRef.current = appointmentIdFromQuery;
                setDate(appointmentDate);
                setVisibleMonth(startOfMonth(appointmentDate));
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    toast({
                        variant: 'destructive',
                        title: 'No se pudo abrir el turno',
                        description: 'El enlace del turno no se pudo resolver en la agenda.',
                    });
                }
            }
        }

        void resolveAppointmentFromQuery();

        return () => {
            cancelled = true;
        };
    }, [searchParams, toast]);

    useEffect(() => {
        const pendingAppointmentId = pendingDeepLinkAppointmentIdRef.current;
        if (!pendingAppointmentId || appointmentsOnDay.length === 0) {
            return;
        }

        const targetAppointment = appointmentsOnDay.find((appointment) => appointment.id === pendingAppointmentId);
        if (!targetAppointment) {
            return;
        }

        setSelectedAppointment(targetAppointment);
        pendingDeepLinkAppointmentIdRef.current = null;
    }, [appointmentsOnDay]);

    const blockedDateSet = useMemo(() => {
        return new Set(Array.isArray(professional?.blockedDates) ? professional.blockedDates : []);
    }, [professional?.blockedDates]);

    const isSelectedDayBlocked = useMemo(() => {
        if (!date) return false;
        return blockedDateSet.has(format(date, 'yyyy-MM-dd'));
    }, [blockedDateSet, date]);

    const timeSlotsForSelectedDay = useMemo(() => {
        if (!date || !professional) return [];

        const selectedDayKey = format(date, 'yyyy-MM-dd');
        if (blockedDateSet.has(selectedDayKey)) {
            return [];
        }

        const workingHours = getWorkingHoursForDate(
            professional.workingHours,
            date,
            professional.appointmentDuration || 30
        );

        if (!workingHours.enabled) {
            return [];
        }

        const allSlots = generateTimeSlots(
            workingHours.start,
            workingHours.end,
            workingHours.appointmentDuration,
            workingHours.breaks
        );

        return allSlots.map(slotTime => {
            const appointmentInSlot = appointmentsOnDay.find(appt => appt.time === slotTime && appt.status !== 'cancelled');
            if (appointmentInSlot) {
                return {
                    time: slotTime,
                    status: 'Ocupado' as const,
                    appointment: appointmentInSlot,
                };
            }
            return {
                time: slotTime,
                status: 'Libre' as const,
                appointment: null,
            };
        });

    }, [date, professional, appointmentsOnDay, blockedDateSet]);
    
    const isLoading = isUserLoading || isLoadingProfessional || isLoadingAppointments;

    return (
        <div className="flex flex-col gap-4 h-full">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Visualiza y gestiona tus turnos.</p>
                </div>
                <Button onClick={() => openAddAppointmentDialog()} className="gap-2 shrink-0">
                    <PlusCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Agendar Turno</span>
                    <span className="sm:hidden">Agendar</span>
                </Button>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                <Card className="lg:col-span-1">
                     <CardContent className="p-1 flex justify-center">
                        {isClient ? (
                            <div className="flex w-full flex-col items-center gap-3">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => {
                                    setDate(d);
                                    if (d) setVisibleMonth(startOfMonth(d));
                                }}
                                month={visibleMonth}
                                onMonthChange={setVisibleMonth}
                                locale={es}
                                weekStartsOn={1}
                                modifiers={{
                                    hasAppointment: (day) => appointmentDayKeys.has(localDayKey(day)),
                                }}
                                components={{
                                    DayButton: CalendarDayButtonWithAppointmentDot,
                                }}
                                disabled={(day) => {
                                  if (!professional) return false;
                                  const dayKey = format(day, 'yyyy-MM-dd');
                                  if (blockedDateSet.has(dayKey)) return true;
                                  const working = getWorkingHoursForDate(
                                    professional.workingHours,
                                    day,
                                    professional.appointmentDuration || 30
                                  );
                                  return !working.enabled;
                                }}
                                className="rounded-md border"
                            />
                            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                                Día con al menos un turno (excluye cancelados)
                            </p>
                            </div>
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
                                        timeSlotsForSelectedDay.map(slot => {
                                            const isPatientConfirmed = slot.status === 'Ocupado' && slot.appointment
                                                ? isPatientAttendanceConfirmed(slot.appointment)
                                                : false;
                                            const isPatientDeclined = slot.status === 'Ocupado' && slot.appointment
                                                ? isPatientAttendanceDeclined(slot.appointment)
                                                : false;

                                            const isDragTarget = dropTargetTime === slot.time && draggingAppointment !== null && draggingAppointment.time !== slot.time;
                                            const isBeingDragged = draggingAppointment?.time === slot.time;
                                            const isOccupied = slot.status === 'Ocupado' && !!slot.appointment;
                                            const canDrop = isDragTarget && !isOccupied;

                                            return (
                                            <div
                                                key={slot.time}
                                                data-slot-time={slot.time}
                                                data-slot-occupied={isOccupied ? 'true' : 'false'}
                                                draggable={isOccupied}
                                                onDragStart={(e) => {
                                                    if (!isOccupied || !slot.appointment) return;
                                                    e.dataTransfer.effectAllowed = 'move';
                                                    draggingRef.current = slot.appointment;
                                                    const appt = slot.appointment;
                                                    setTimeout(() => {
                                                        setDraggingAppointment(appt);
                                                        setDropTargetTime(null);
                                                    }, 0);
                                                }}
                                                onDragEnd={() => {
                                                    draggingRef.current = null;
                                                    setDraggingAppointment(null);
                                                    setDropTargetTime(null);
                                                }}
                                                onDragOver={(e) => {
                                                    if (draggingAppointment) {
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = isOccupied ? 'none' : 'move';
                                                        setDropTargetTime(slot.time);
                                                    }
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const appt = draggingRef.current;
                                                    if (appt && appt.time !== slot.time && !isOccupied) {
                                                        setDragConfirm({ appointment: appt, newTime: slot.time });
                                                    }
                                                    setDraggingAppointment(null);
                                                    draggingRef.current = null;
                                                    setDropTargetTime(null);
                                                }}
                                                onDragLeave={(e) => {
                                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                        setDropTargetTime(null);
                                                    }
                                                }}
                                                // ── Touch drag (mobile) ──────────────────────────────
                                                onTouchStart={isOccupied && slot.appointment ? (e) => {
                                                    const touch = e.touches[0];
                                                    draggingRef.current = slot.appointment;
                                                    dropTargetTimeRef.current = null;
                                                    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
                                                    setTimeout(() => {
                                                        setDraggingAppointment(slot.appointment!);
                                                        setDropTargetTime(null);
                                                    }, 0);
                                                } : undefined}
                                                onTouchMove={isOccupied ? (e) => {
                                                    if (!draggingRef.current) return;
                                                    const touch = e.touches[0];
                                                    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
                                                    // Hide ghost briefly to let elementFromPoint see through it
                                                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                                                    const slotEl = el?.closest('[data-slot-time]') as HTMLElement | null;
                                                    const targetTime = slotEl?.dataset.slotTime ?? null;
                                                    dropTargetTimeRef.current = targetTime;
                                                    setDropTargetTime(targetTime);
                                                } : undefined}
                                                onTouchEnd={isOccupied ? () => {
                                                    const appt = draggingRef.current;
                                                    const targetTime = dropTargetTimeRef.current;
                                                    draggingRef.current = null;
                                                    dropTargetTimeRef.current = null;
                                                    setTouchGhostPos(null);
                                                    setDraggingAppointment(null);
                                                    setDropTargetTime(null);
                                                    if (appt && targetTime && targetTime !== appt.time) {
                                                        const target = timeSlotsForSelectedDay.find(s => s.time === targetTime);
                                                        if (target?.status !== 'Ocupado') {
                                                            setDragConfirm({ appointment: appt, newTime: targetTime });
                                                        }
                                                    }
                                                } : undefined}
                                                onTouchCancel={isOccupied ? () => {
                                                    draggingRef.current = null;
                                                    dropTargetTimeRef.current = null;
                                                    setTouchGhostPos(null);
                                                    setDraggingAppointment(null);
                                                    setDropTargetTime(null);
                                                } : undefined}
                                                className={cn(
                                                    "rounded-xl flex flex-col gap-2 transition-all duration-150 select-none",
                                                    isOccupied && !isBeingDragged && 'cursor-grab active:cursor-grabbing',
                                                    isBeingDragged && 'opacity-30 scale-[0.98]',
                                                    canDrop && 'ring-2 ring-primary ring-offset-1 bg-primary/5 border-primary/30',
                                                    isDragTarget && isOccupied && 'ring-2 ring-destructive/40 ring-offset-1',
                                                    !isBeingDragged && !isDragTarget && (
                                                        isOccupied
                                                            ? isPatientConfirmed
                                                                ? 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:border-emerald-900/70 dark:hover:bg-emerald-950/45'
                                                                : isPatientDeclined
                                                                    ? 'bg-red-50 border border-red-200 hover:bg-red-100/70 dark:bg-red-950/30 dark:border-red-900/70 dark:hover:bg-red-950/45'
                                                                    : 'bg-secondary/60 hover:bg-secondary'
                                                            : draggingAppointment
                                                                ? 'bg-background border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5'
                                                                : 'bg-background border border-dashed border-border/60 hover:border-border hover:bg-secondary/30'
                                                    )
                                                )}
                                            >
                                                <div className="flex items-center gap-3 p-3">
                                                    <div className="font-semibold text-sm w-14 text-center shrink-0 tabular-nums text-muted-foreground">
                                                        {slot.time}
                                                    </div>

                                                    {isOccupied && slot.appointment ? (
                                                        <>
                                                            {/* Grip visual hint — not the drag source, whole card is */}
                                                            <GripVertical className="h-4 w-4 shrink-0 -ml-1 text-muted-foreground/30 group-hover:text-muted-foreground/60" aria-hidden />
                                                            <div
                                                                className="flex items-center gap-3 flex-1 min-w-0"
                                                                onClick={() => !draggingAppointment && setSelectedAppointment(slot.appointment)}
                                                            >
                                                                <Avatar className="h-9 w-9 shrink-0">
                                                                    <AvatarImage src={slot.appointment.patientAvatarUrl} alt={slot.appointment.patientName} />
                                                                    <AvatarFallback className="text-sm font-semibold">{slot.appointment.patientName.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold truncate">{slot.appointment.patientName}</p>
                                                                    <p className="text-xs text-muted-foreground">{slot.appointment.type === 'checkup' ? 'Control' : slot.appointment.type === 'first_time' ? 'Primera Vez' : 'Urgencia'}</p>
                                                                </div>
                                                            </div>
                                                            {(() => {
                                                                const badge = getAppointmentBadge(slot.appointment);
                                                                return (
                                                                    <Badge variant="outline" className={cn(badge.className, 'border-none shrink-0 text-xs')}>
                                                                        {badge.label}
                                                                    </Badge>
                                                                );
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className={cn(
                                                                "flex-1 text-sm font-medium transition-colors",
                                                                canDrop ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400'
                                                            )}>
                                                                {canDrop ? 'Soltar aquí' : 'Libre'}
                                                            </div>
                                                            {!draggingAppointment && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openAddAppointmentDialog(slot.time);
                                                                    }}
                                                                >
                                                                    <PlusCircle className="h-3.5 w-3.5" />
                                                                    Agendar
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                {slot.status === 'Ocupado' && slot.appointment && (() => {
                                                    const appt = slot.appointment;
                                                    const apptId = appt.id || (appt as any)._id?.toString() || '';
                                                    const isUpdating = updatingId === apptId;
                                                    const apptDate = new Date(appt.date as unknown as string);
                                                    const showReminder = appt.status === 'confirmed' && isTomorrow(apptDate);
                                                    const canConfirm = appt.status === 'pending';

                                                    if (!canConfirm && !showReminder) return null;

                                                    return (
                                                        <div className="flex gap-1.5 px-3 pb-2.5 flex-wrap" style={{ paddingLeft: 'calc(3.5rem + 0.75rem)' }}>
                                                            {canConfirm && (
                                                                <Button size="sm" variant="outline" disabled={isUpdating}
                                                                    onClick={(e) => { e.stopPropagation(); handleAppointmentAction(apptId, 'confirm'); }}
                                                                    className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 h-7 text-xs rounded-lg">
                                                                    {isUpdating ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                    Confirmar
                                                                </Button>
                                                            )}
                                                            {showReminder && (
                                                                <Button size="sm" variant="outline" disabled={isUpdating}
                                                                    onClick={(e) => { e.stopPropagation(); handleAppointmentAction(apptId, 'send_reminder'); }}
                                                                    className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7 text-xs rounded-lg">
                                                                    {isUpdating ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Bell className="h-3.5 w-3.5" />}
                                                                    Recordatorio
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground h-full">
                                            <CalendarIcon className="h-12 w-12 mb-4" />
                                            <h3 className="text-lg font-semibold">
                                                {isSelectedDayBlocked ? 'Día no laborable' : 'No hay turnos para este día'}
                                            </h3>
                                            <p className="mt-1 text-sm">
                                                {isSelectedDayBlocked
                                                    ? 'Este día está bloqueado en tu configuración de días libres.'
                                                    : 'Ajusta tus horarios de atención en la configuración.'}
                                            </p>
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
                onOpenChange={(isOpen) => {
                    if (isOpen) return;
                    setSelectedAppointment(null);

                    const currentAppointmentId = searchParams.get('appointmentId');
                    if (!currentAppointmentId) return;

                    const nextParams = new URLSearchParams(searchParams.toString());
                    nextParams.delete('appointmentId');
                    const nextQuery = nextParams.toString();
                    router.replace(nextQuery ? `/dashboard/calendario?${nextQuery}` : '/dashboard/calendario');
                }}
                professionalName={professional?.name}
                professionalAddress={professional?.address}
                onUpdated={(updated) => {
                    if (updated) {
                        setAppointmentsOnDay((prev) =>
                            prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
                        );
                    }
                    setAppointmentsReloadKey((k) => k + 1);
                }}
            />

            {/* Touch drag ghost — follows finger */}
            {touchGhostPos && draggingAppointment && (
                <div
                    className="fixed z-50 pointer-events-none rounded-xl border bg-card shadow-xl px-3 py-2 flex items-center gap-2 text-sm max-w-[200px]"
                    style={{
                        left: touchGhostPos.x,
                        top: touchGhostPos.y,
                        transform: 'translate(-50%, -130%)',
                    }}
                >
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={draggingAppointment.patientAvatarUrl} alt={draggingAppointment.patientName} />
                        <AvatarFallback className="text-xs font-semibold">{draggingAppointment.patientName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="font-semibold truncate text-xs">{draggingAppointment.patientName}</p>
                        <p className="text-xs text-muted-foreground">{draggingAppointment.time} hs</p>
                    </div>
                </div>
            )}

            {/* Drag & drop reschedule confirmation */}
            <Dialog
                open={!!dragConfirm}
                onOpenChange={(open) => {
                    if (!open) {
                        setDragConfirm(null);
                        setPatientConfirmedOnDrop(false);
                    }
                }}
            >
                <DialogContent className="sm:max-w-sm rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Mover turno</DialogTitle>
                        <DialogDescription className="sr-only">
                            Confirmar reprogramación del turno
                        </DialogDescription>
                    </DialogHeader>

                    {dragConfirm && (
                        <div className="space-y-4 py-1">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60">
                                <Avatar className="h-9 w-9 shrink-0">
                                    <AvatarImage src={dragConfirm.appointment.patientAvatarUrl} alt={dragConfirm.appointment.patientName} />
                                    <AvatarFallback className="text-sm font-semibold">{dragConfirm.appointment.patientName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{dragConfirm.appointment.patientName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {dragConfirm.appointment.time} hs → <span className="font-semibold text-foreground">{dragConfirm.newTime} hs</span>
                                    </p>
                                </div>
                            </div>

                            <label className="flex items-start gap-3 cursor-pointer group" htmlFor="patient-confirmed-drop">
                                <Checkbox
                                    id="patient-confirmed-drop"
                                    checked={patientConfirmedOnDrop}
                                    onCheckedChange={(v) => setPatientConfirmedOnDrop(!!v)}
                                    className="mt-0.5 shrink-0"
                                />
                                <div className="text-sm leading-snug">
                                    <span className="font-medium group-hover:text-foreground transition-colors">El paciente confirmó su asistencia</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">El turno quedará marcado como confirmado por el paciente y no se enviará recordatorio.</p>
                                </div>
                            </label>
                        </div>
                    )}

                    <DialogFooter className="gap-2 flex-row justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setDragConfirm(null); setPatientConfirmedOnDrop(false); }}
                            disabled={isRescheduling}
                            className="rounded-xl h-9"
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => dragConfirm && handleReschedule(dragConfirm.appointment, dragConfirm.newTime, patientConfirmedOnDrop)}
                            disabled={isRescheduling}
                            className="rounded-xl h-9"
                        >
                            {isRescheduling ? (
                                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />Moviendo...</>
                            ) : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
