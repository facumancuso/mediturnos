'use client';

import { ArrowUpRight, Users, Calendar as CalendarIcon, Clock, Activity, Download, Eye } from 'lucide-react';
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
import { allAppointments } from '@/lib/mock-data';
import type { Appointment } from '@/types';
import { isToday } from 'date-fns';
import { useState, useEffect } from 'react';
import { AppointmentDetailsDialog } from '@/components/appointment-details-dialog';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const appointmentsToday = allAppointments.filter(appt => isToday(appt.date)).sort((a, b) => a.time.localeCompare(b.time));
const confirmedAppointments = appointmentsToday.filter(appt => appt.status === 'confirmed').length;

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

export default function VistaProfesionalPage() {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <>
      <Alert className="mb-6 border-blue-500 text-blue-800 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/20">
        <Eye className="h-4 w-4 !text-blue-800 dark:!text-blue-300" />
        <AlertTitle className="text-blue-900 dark:text-blue-200">Vista de Ejemplo: Profesional</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400">
            Esta es una vista previa de cómo un profesional (que no es dueño de la clínica) vería su panel principal. La data es de ejemplo. El acceso real se basa en el inicio de sesión del usuario y su rol asignado.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnos de Hoy</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointmentsToday.length}</div>
            <p className="text-xs text-muted-foreground">+2 vs ayer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedAppointments}</div>
            <p className="text-xs text-muted-foreground">{Math.round((confirmedAppointments / (appointmentsToday.length || 1)) * 100)}% de los turnos de hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Ocupación (mes)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">82%</div>
            <p className="text-xs text-muted-foreground">+5% vs mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Asistieron (mes)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">-2 vs mes pasado</p>
          </CardContent>
        </Card>
      </div>
      
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
            <div className="relative pl-6">
              <div className="absolute left-6 top-0 h-full w-px bg-border -translate-x-1/2"></div>
                <div className="space-y-8">
                    {appointmentsToday.map((appt) => (
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
                    ))}
                    {appointmentsToday.length === 0 && (
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resumen Próximos 3 Días</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
             <div className="flex items-center justify-between">
              <div className="font-medium">Mañana</div>
              <div className="text-muted-foreground">15 turnos</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-medium">Viernes</div>
              <div className="text-muted-foreground">11 turnos</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-medium">Sábado</div>
              <div className="text-muted-foreground">5 turnos</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-medium text-destructive">Lista de espera</div>
              <div className="text-muted-foreground">3 pacientes</div>
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
