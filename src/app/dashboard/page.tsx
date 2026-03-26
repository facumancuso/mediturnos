'use client';

import { ArrowUpRight, Users, Calendar as CalendarIcon, Clock, Activity, Download } from 'lucide-react';
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
import type { Appointment } from '@/types';
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { AppointmentDetailsDialog } from '@/components/appointment-details-dialog';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
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
}

export default function DashboardHomePage() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [appointmentsToday, setAppointmentsToday] = useState<Appointment[]>([]);
  const [appointmentsYesterday, setAppointmentsYesterday] = useState<Appointment[]>([]);
  const [appointmentsMonth, setAppointmentsMonth] = useState<Appointment[]>([]);
  const [appointmentsPreviousMonth, setAppointmentsPreviousMonth] = useState<Appointment[]>([]);
  const [appointmentsNext3Days, setAppointmentsNext3Days] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const { user, isUserLoading } = useUser();

  const fetchAppointmentsByDay = async (professionalId: string, day: Date) => {
    const dayParam = format(day, 'yyyy-MM-dd');
    const response = await fetchWithAuth(
      `/api/dashboard/appointments?professionalId=${professionalId}&day=${dayParam}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('No se pudieron cargar los turnos por día.');
    }

    return (await response.json()) as Appointment[];
  };

  const fetchAppointmentsByRange = async (professionalId: string, start: Date, end: Date) => {
    const response = await fetchWithAuth(
      `/api/dashboard/appointments?professionalId=${professionalId}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('No se pudieron cargar los turnos por rango.');
    }

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
        if (!cancelled) {
          setIsLoadingAppointments(false);
        }
      }
    }

    loadAppointmentsToday();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const confirmedAppointments = useMemo(() => {
    return appointmentsToday.filter(appt => appt.status === 'confirmed').length;
  }, [appointmentsToday]);

  const todayVsYesterdayDiff = useMemo(() => {
    return appointmentsToday.length - appointmentsYesterday.length;
  }, [appointmentsToday.length, appointmentsYesterday.length]);

  const getMonthlyOccupancy = (appointments: Appointment[]) => {
    if (appointments.length === 0) return 0;
    const occupied = appointments.filter(
      (appointment) => appointment.status !== 'cancelled'
    ).length;
    return Math.round((occupied / appointments.length) * 100);
  };

  const monthlyOccupancy = useMemo(() => getMonthlyOccupancy(appointmentsMonth), [appointmentsMonth]);
  const previousMonthlyOccupancy = useMemo(
    () => getMonthlyOccupancy(appointmentsPreviousMonth),
    [appointmentsPreviousMonth]
  );
  const monthlyOccupancyDiff = monthlyOccupancy - previousMonthlyOccupancy;

  const noShowsMonth = useMemo(
    () => appointmentsMonth.filter((appointment) => appointment.status === 'no_show').length,
    [appointmentsMonth]
  );
  const noShowsPreviousMonth = useMemo(
    () => appointmentsPreviousMonth.filter((appointment) => appointment.status === 'no_show').length,
    [appointmentsPreviousMonth]
  );
  const noShowDiff = noShowsMonth - noShowsPreviousMonth;

  const upcoming3DaysSummary = useMemo(() => {
    const now = new Date();

    return [1, 2, 3].map((offset) => {
      const targetDay = startOfDay(addDays(now, offset));
      const dayLabel = offset === 1 ? 'Mañana' : format(targetDay, 'EEEE');
      const dayKey = format(targetDay, 'yyyy-MM-dd');

      const count = appointmentsNext3Days.filter(
        (appointment) => format(new Date((appointment as unknown as { date: string }).date), 'yyyy-MM-dd') === dayKey
      ).length;

      return {
        label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        count,
      };
    });
  }, [appointmentsNext3Days]);

  const waitListCount = useMemo(
    () => appointmentsNext3Days.filter((appointment) => appointment.status === 'pending').length,
    [appointmentsNext3Days]
  );
  
  const sortedAppointments = useMemo(() => {
    return [...appointmentsToday].sort((a, b) => a.time.localeCompare(b.time));
  }, [appointmentsToday]);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const isLoading = isUserLoading || isLoadingAppointments;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnos de Hoy</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{appointmentsToday.length}</div>}
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? '...'
                : `${todayVsYesterdayDiff >= 0 ? '+' : ''}${todayVsYesterdayDiff} vs ayer`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{confirmedAppointments}</div>}
            <p className="text-xs text-muted-foreground">
              {isLoading || appointmentsToday.length === 0 ? '...' : `${Math.round((confirmedAppointments / appointmentsToday.length) * 100)}% de los turnos de hoy`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Ocupación (mes)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{monthlyOccupancy}%</div>}
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? '...'
                : `${monthlyOccupancyDiff >= 0 ? '+' : ''}${monthlyOccupancyDiff}% vs mes pasado`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Asistieron (mes)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{noShowsMonth}</div>}
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? '...'
                : `${noShowDiff >= 0 ? '+' : ''}${noShowDiff} vs mes pasado`}
            </p>
          </CardContent>
        </Card>
      </div>

      <OnboardingChecklist />
      
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Turnos del Día</CardTitle>
              <CardDescription>
                {isClient ? `Esta es la agenda para hoy, ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.` : 'Cargando agenda...'}
              </CardDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button asChild size="sm" className="gap-1">
                <a href="/dashboard/calendario">
                  Ver Calendario
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <div className="space-y-4 pt-6 pl-6">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
            ) : (
                <div className="relative pl-6">
                  <div className="absolute left-6 top-0 h-full w-px bg-border -translate-x-1/2"></div>
                    <div className="space-y-8">
                        {sortedAppointments && sortedAppointments.length > 0 ? sortedAppointments.map((appt) => (
                            <div key={appt.id} className="relative flex items-start gap-4">
                                 <div className="absolute left-0 top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                                    <div className="h-3 w-3 rounded-full bg-primary" />
                                 </div>
                                <div className="text-sm font-medium text-muted-foreground w-16 text-right pt-1 pr-2">{appt.time}</div>
                                <div className="flex-1 p-3 rounded-lg bg-muted">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="hidden h-9 w-9 sm:flex">
                                                <AvatarImage src={appt.patientAvatarUrl} alt="Avatar" />
                                                <AvatarFallback>{appt.patientName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="font-semibold">{appt.patientName}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`${statusStyles[appt.status]} border-none`}>{statusLabels[appt.status]}</Badge>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(appt)}>Ver</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center pl-0">
                                <div className="relative flex items-start gap-4 w-full">
                                    <div className="absolute left-0 top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 flex flex-col items-center justify-center text-center -ml-8">
                                        <h3 className="mt-4 text-lg font-semibold">No hay turnos para hoy</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">Tu agenda está libre. ¡Disfruta el día!</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumen Próximos 3 Días</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            {isLoading
              ? [...Array(3)].map((_, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              : upcoming3DaysSummary.map((daySummary) => (
                  <div key={daySummary.label} className="flex items-center justify-between">
                    <div className="font-medium">{daySummary.label}</div>
                    <div className="text-muted-foreground">{daySummary.count} turnos</div>
                  </div>
                ))}
            <div className="flex items-center justify-between">
              <div className="font-medium text-destructive">Lista de espera</div>
              {isLoading ? <Skeleton className="h-4 w-16" /> : <div className="text-muted-foreground">{waitListCount} pacientes</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onOpenChange={(isOpen) => !isOpen && setSelectedAppointment(null)}
      />
    </>
  );
}
