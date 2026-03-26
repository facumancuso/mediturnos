'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Patient, Appointment } from '@/types';
import { allAppointments } from '@/lib/mock-data';
import { User, Calendar, Phone, Mail, StickyNote, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type PatientDetailsDialogProps = {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PatientDetailsDialog({ patient, open, onOpenChange }: PatientDetailsDialogProps) {
  if (!patient) return null;

  const patientAppointments = allAppointments
    .filter(appt => appt.patientId === patient.id)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 max-h-[90svh] flex flex-col">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Ficha del Paciente</DialogTitle>
          <DialogDescription>
            Historial completo y detalles de {patient.name}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Patient Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-muted">
                        <Avatar className="h-24 w-24 border">
                            <AvatarImage src={patient.avatarUrl} alt={patient.name} />
                            <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                            <p className="font-semibold text-xl">{patient.name}</p>
                            <p className="text-sm text-muted-foreground">DNI: {patient.dni}</p>
                        </div>
                    </div>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Contacto</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{patient.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{patient.email}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Estadísticas</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Última visita:</span>
                                <span className="font-medium">{patient.lastVisit.split('-').reverse().join('/')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Visitas totales:</span>
                                <span className="font-medium">{patient.totalVisits}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Inasistencias:</span>
                                <span className="font-medium text-destructive">{patient.missedAppointments}</span>
                            </div>
                        </CardContent>
                    </Card>
                    {patient.notes && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4" /> Notas Privadas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{patient.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
                {/* Right Column: Appointment History */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Historial de Turnos</h3>
                    <div className="border rounded-md">
                        <div className="p-4 space-y-4">
                            {patientAppointments.length > 0 ? (
                                patientAppointments.map(appt => (
                                    <div key={appt.id} className="border p-3 rounded-lg flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{new Date(appt.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {appt.time} hs</p>
                                            <p className="text-sm text-muted-foreground capitalize">{appt.type === 'checkup' ? 'Control' : appt.type === 'first_time' ? 'Primera Vez' : 'Urgencia'}</p>
                                        </div>
                                        <Badge variant="outline" className={cn("border-none", statusStyles[appt.status])}>
                                            {statusLabels[appt.status]}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Calendar className="mx-auto h-12 w-12" />
                                    <p className="mt-4">No hay turnos registrados para este paciente.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
