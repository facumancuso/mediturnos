'use client';

import { ArrowUpRight, Users, Calendar as CalendarIcon, Clock, Activity, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Appointment, Professional } from '@/types';
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useMemo } from 'react';
import { AppointmentDetailsDialog } from '@/components/appointment-details-dialog';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { cn } from '@/lib/utils';

const statusStyles: { [key in Appointment['status']]: string } = {
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const statusLabels: { [key in Appointment['status']]: string } = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

function getAppointmentStatusBadge(appointment: Appointment) {
  const responseValue = String(appointment.patientResponse || '').toLowerCase();
  const patientConfirmed =
    appointment.status === 'confirmed' &&
    (responseValue === 'confirmed' || (Boolean(appointment.patientRespondedAt) && responseValue !== 'declined'));

  if (patientConfirmed) {
    return {
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      label: 'Confirmado por paciente',
    };
  }

  return {
    className: statusStyles[appointment.status],
    label: statusLabels[appointment.status],
  };
}

const typeLabels: Record<string, string> = {
  checkup: 'Control',
  first_time: 'Primera Vez',
  urgency: 'Urgencia',
};

export default function DashboardHomePage() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [appointmentsToday, setAppointmentsToday] = useState<Appointment[]>([]);
  const [appointmentsYesterday, setAppointmentsYesterday] = useState<Appointment[]>([]);
  const [appointmentsMonth, setAppointmentsMonth] = useState<Appointment[]>([]);
  const [appointmentsPreviousMonth, setAppointmentsPreviousMonth] = useState<Appointment[]>([]);
  const [appointmentsNext3Days, setAppointmentsNext3Days] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [appointmentsReloadKey, setAppointmentsReloadKey] = useState(0);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const { user, isUserLoading } = useUser();

  const fetchAppointmentsByDay = async (professionalId: string, day: Date) => {
    const dayParam = format(day, 'yyyy-MM-dd');
    const response = await fetchWithAuth(
      `/api/dashboard/appointments?professionalId=${professionalId}&day=${dayParam}`,
      { cache: 'no-store' }
    );
    if (!response.ok) throw new Error('No se pudieron cargar los turnos por día.');
    return (await response.json()) as Appointment[];
  };

  const fetchAppointmentsByRange = async (professionalId: string, start: Date, end: Date) => {
    const response = await fetchWithAuth(
      `/api/dashboard/appointments?professionalId=${professionalId}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      { cache: 'no-store' }
    );
    if (!response.ok) throw new Error('No se pudieron cargar los turnos por rango.');
    return (await response.json()) as Appointment[];
  };

  useEffect(() => {
    const professionalId = user?.uid;
    if (!professionalId) {
      setAppointmentsToday([]);
      return;
    }
    const safeProfessionalId = professionalId;
    let cancelled = false;

    async function loadProfessionalProfile() {
      try {
        const res = await fetchWithAuth(`/api/dashboard/professional?professionalId=${professionalId}`, { cache: 'no-store' });
        if (res.ok && !cancelled) setProfessional((await res.json()) as Professional);
      } catch { /* non-critical */ }
    }

    loadProfessionalProfile();

    async function loadAppointmentsToday() {
      try {
        setIsLoadingAppointments(true);
        const now = new Date();
        const today = startOfDay(now);
        const yesterday = addDays(today, -1);
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const previousMonthDate = subMonths(now, 1);
        const previousMonthStart = startOfMonth(previousMonthDate);
        const previousMonthEnd = endOfMonth(previousMonthDate);
        const next3DaysStart = startOfDay(addDays(now, 1));
        const next3DaysEnd = endOfDay(addDays(now, 3));

        const [
          todayData,
          yesterdayData,
          monthData,
          previousMonthData,
          next3DaysData,
        ] = await Promise.all([
          fetchAppointmentsByDay(safeProfessionalId, today),
          fetchAppointmentsByDay(safeProfessionalId, yesterday),
          fetchAppointmentsByRange(safeProfessionalId, monthStart, monthEnd),
          fetchAppointmentsByRange(safeProfessionalId, previousMonthStart, previousMonthEnd),
          fetchAppointmentsByRange(safeProfessionalId, next3DaysStart, next3DaysEnd),
        ]);

        if (!cancelled) {
          setAppointmentsToday(todayData);
          setAppointmentsYesterday(yesterdayData);
          setAppointmentsMonth(monthData);
          setAppointmentsPreviousMonth(previousMonthData);
          setAppointmentsNext3Days(next3DaysData);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAppointmentsToday([]);
          setAppointmentsYesterday([]);
          setAppointmentsMonth([]);
          setAppointmentsPreviousMonth([]);
          setAppointmentsNext3Days([]);
        }
      } finally {
        if (!cancelled) setIsLoadingAppointments(false);
      }
    }

    loadAppointmentsToday();
    return () => { cancelled = true; };
  }, [user?.uid, appointmentsReloadKey]);

  const confirmedAppointments = useMemo(
    () => appointmentsToday.filter((a) => a.status === 'confirmed').length,
    [appointmentsToday]
  );

  const todayVsYesterdayDiff = useMemo(
    () => appointmentsToday.length - appointmentsYesterday.length,
    [appointmentsToday.length, appointmentsYesterday.length]
  );

  const getMonthlyOccupancy = (appointments: Appointment[]) => {
    if (appointments.length === 0) return 0;
    const occupied = appointments.filter((a) => a.status !== 'cancelled').length;
    return Math.round((occupied / appointments.length) * 100);
  };

  const monthlyOccupancy = useMemo(() => getMonthlyOccupancy(appointmentsMonth), [appointmentsMonth]);
  const previousMonthlyOccupancy = useMemo(() => getMonthlyOccupancy(appointmentsPreviousMonth), [appointmentsPreviousMonth]);
  const monthlyOccupancyDiff = monthlyOccupancy - previousMonthlyOccupancy;

  const noShowsMonth = useMemo(
    () => appointmentsMonth.filter((a) => a.status === 'no_show').length,
    [appointmentsMonth]
  );
  const noShowsPreviousMonth = useMemo(
    () => appointmentsPreviousMonth.filter((a) => a.status === 'no_show').length,
    [appointmentsPreviousMonth]
  );
  const noShowDiff = noShowsMonth - noShowsPreviousMonth;

  const upcoming3DaysSummary = useMemo(() => {
    const now = new Date();
    return [1, 2, 3].map((offset) => {
      const targetDay = startOfDay(addDays(now, offset));
      const dayLabel = offset === 1 ? 'Mañana' : format(targetDay, 'EEEE', { locale: es });
      const dayKey = format(targetDay, 'yyyy-MM-dd');
      const count = appointmentsNext3Days.filter(
        (a) => format(new Date((a as unknown as { date: string }).date), 'yyyy-MM-dd') === dayKey
      ).length;
      return { label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), count };
    });
  }, [appointmentsNext3Days]);

  const waitListCount = useMemo(
    () => appointmentsNext3Days.filter((a) => a.status === 'pending').length,
    [appointmentsNext3Days]
  );

  const sortedAppointments = useMemo(
    () => [...appointmentsToday].sort((a, b) => a.time.localeCompare(b.time)),
    [appointmentsToday]
  );

  useEffect(() => { setIsClient(true); }, []);

  const isLoading = isUserLoading || isLoadingAppointments;

  // Trend indicator helper
  const Trend = ({ diff, invert = false }: { diff: number; invert?: boolean }) => {
    const isPositive = invert ? diff <= 0 : diff >= 0;
    const isNeutral = diff === 0;
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isNeutral ? 'text-muted-foreground' : isPositive ? 'text-emerald-600' : 'text-red-500'
      )}>
        {isNeutral
          ? <Minus className="h-3 w-3" />
          : isPositive
            ? <TrendingUp className="h-3 w-3" />
            : <TrendingDown className="h-3 w-3" />
        }
        {diff >= 0 ? '+' : ''}{diff}
      </span>
    );
  };

  return (
    <>
      {/* ── Metric cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Turnos de Hoy */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Turnos de Hoy</p>
                {isLoading
                  ? <Skeleton className="h-9 w-16 mt-1" />
                  : <p className="text-3xl font-bold tracking-tight">{appointmentsToday.length}</p>
                }
                <div className="flex items-center gap-1.5 pt-0.5">
                  {isLoading
                    ? <Skeleton className="h-4 w-20" />
                    : <><Trend diff={todayVsYesterdayDiff} /><span className="text-xs text-muted-foreground">vs ayer</span></>
                  }
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmados */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmados</p>
                {isLoading
                  ? <Skeleton className="h-9 w-16 mt-1" />
                  : <p className="text-3xl font-bold tracking-tight">{confirmedAppointments}</p>
                }
                <div className="pt-0.5">
                  {isLoading
                    ? <Skeleton className="h-4 w-28" />
                    : <span className="text-xs text-muted-foreground">
                        {appointmentsToday.length > 0
                          ? `${Math.round((confirmedAppointments / appointmentsToday.length) * 100)}% de los de hoy`
                          : 'Sin turnos hoy'}
                      </span>
                  }
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasa de Ocupación */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ocupación (mes)</p>
                {isLoading
                  ? <Skeleton className="h-9 w-16 mt-1" />
                  : <p className="text-3xl font-bold tracking-tight">{monthlyOccupancy}%</p>
                }
                <div className="flex items-center gap-1.5 pt-0.5">
                  {isLoading
                    ? <Skeleton className="h-4 w-20" />
                    : <><Trend diff={monthlyOccupancyDiff} /><span className="text-xs text-muted-foreground">vs mes ant.</span></>
                  }
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No Asistieron */}
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">No Asistieron (mes)</p>
                {isLoading
                  ? <Skeleton className="h-9 w-16 mt-1" />
                  : <p className="text-3xl font-bold tracking-tight">{noShowsMonth}</p>
                }
                <div className="flex items-center gap-1.5 pt-0.5">
                  {isLoading
                    ? <Skeleton className="h-4 w-20" />
                    : <><Trend diff={noShowDiff} invert /><span className="text-xs text-muted-foreground">vs mes ant.</span></>
                  }
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/30">
                <Clock className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OnboardingChecklist />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Timeline ── */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Turnos del día</CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                {isClient
                  ? new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Cargando agenda...'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 hidden sm:flex">
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                <a href="/dashboard/calendario">
                  Calendario
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : sortedAppointments.length > 0 ? (
              <div className="space-y-2">
                {sortedAppointments.map((appt) => {
                  const badge = getAppointmentStatusBadge(appt);
                  return (
                  <button
                    key={appt.id}
                    onClick={() => setSelectedAppointment(appt)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors duration-150 text-left group"
                  >
                    {/* Time column */}
                    <div className="flex flex-col items-center justify-center min-w-[48px]">
                      <span className="text-sm font-semibold tabular-nums">{appt.time}</span>
                    </div>

                    {/* Divider */}
                    <div className="h-9 w-px bg-border shrink-0" />

                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0 hidden sm:flex">
                      <AvatarImage src={appt.patientAvatarUrl} alt={appt.patientName} />
                      <AvatarFallback className="text-sm font-semibold">{appt.patientName.charAt(0)}</AvatarFallback>
                    </Avatar>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{appt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
                    </div>

                    {/* Status + action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn('border-none text-xs font-medium hidden sm:inline-flex', badge.className)}
                      >
                        {badge.label}
                      </Badge>
                      <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        Ver →
                      </span>
                    </div>
                  </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <CalendarIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">Sin turnos para hoy</h3>
                <p className="mt-1 text-xs text-muted-foreground">Tu agenda está libre. ¡Disfruta el día!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Upcoming 3 days ── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Próximos 3 días</CardTitle>
            <CardDescription className="text-sm">Resumen de la semana</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {isLoading
              ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
              : upcoming3DaysSummary.map((day) => (
                  <div
                    key={day.label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/50"
                  >
                    <span className="text-sm font-medium capitalize">{day.label}</span>
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      day.count > 0 ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {day.count} {day.count === 1 ? 'turno' : 'turnos'}
                    </span>
                  </div>
                ))
            }

            {/* Waitlist separator */}
            <div className="pt-1 border-t border-border/40 mt-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Lista de espera</span>
                {isLoading
                  ? <Skeleton className="h-4 w-12" />
                  : <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                      {waitListCount} {waitListCount === 1 ? 'paciente' : 'pacientes'}
                    </span>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onOpenChange={(isOpen) => !isOpen && setSelectedAppointment(null)}
        professionalName={professional?.name}
        professionalAddress={professional?.address}
        onUpdated={(updated) => {
          if (updated) {
            const patch = (arr: Appointment[]) =>
              arr.map((a) => (a.id === updated.id ? { ...a, ...updated } : a));
            setAppointmentsToday(patch);
            setAppointmentsYesterday(patch);
            setAppointmentsMonth(patch);
            setAppointmentsPreviousMonth(patch);
            setAppointmentsNext3Days(patch);
          }
          setAppointmentsReloadKey((k) => k + 1);
        }}
      />
    </>
  );
}
