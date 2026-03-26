'use client';

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { allAppointments, mockProfessionals } from "@/lib/mock-data";
import type { Appointment } from "@/types";
import { isSameDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar as CalendarIcon, Eye, Users } from "lucide-react";
import { AddAppointmentDialog } from "@/components/add-appointment-dialog";
import { AppointmentDetailsDialog } from "@/components/appointment-details-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from "@/components/ui/skeleton";

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

function getAppointmentEndTime(startTime: string, duration: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    return endDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function VistaSecretariaPage() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [selectedProfessional, setSelectedProfessional] = useState(mockProfessionals[0].id);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const appointmentsForSelectedDay = useMemo(() => {
        if (!date) return [];
        // NOTE: In a real app, this would filter by selectedProfessional as well.
        // For this example, we show all appointments to ensure the calendar has data.
        return allAppointments
            .filter(appt => isSameDay(appt.date, date))
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [date]);

    return (
        <>
            <Alert className="mb-6 border-purple-500 text-purple-800 dark:border-purple-700 dark:text-purple-300 dark:bg-purple-900/20">
                <Eye className="h-4 w-4 !text-purple-800 dark:!text-purple-300" />
                <AlertTitle className="text-purple-900 dark:text-purple-200">Vista de Ejemplo: Secretaria</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-400">
                    Esta es una vista previa de cómo una secretaria gestionaría los calendarios de la clínica. Puedes cambiar de profesional usando el selector para ver su agenda (en este ejemplo, la agenda es la misma para todos).
                </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-4 h-full">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Calendario de la Organización</h1>
                        <p className="text-muted-foreground">Visualiza y gestiona los turnos de todos los profesionales.</p>
                    </div>
                    <div className="flex items-center gap-4">
                         <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                            <SelectTrigger className="w-[280px]">
                                <Users className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Seleccionar profesional" />
                            </SelectTrigger>
                            <SelectContent>
                                {mockProfessionals.map(prof => (
                                    <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <AddAppointmentDialog>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Agendar Turno
                            </Button>
                        </AddAppointmentDialog>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                    <Card className="lg:col-span-1">
                         <CardContent className="p-1 flex justify-center">
                            {isClient ? (
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    className="rounded-md border"
                                />
                            ) : (
                                <div className="p-3"><Skeleton className="h-[298px] w-full rounded-md" /></div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="capitalize">
                                {isClient && date ? `Turnos para el ${format(date, "eeee d 'de' MMMM", { locale: es })}` : 'Cargando...'}
                            </CardTitle>
                            <CardDescription>
                                {appointmentsForSelectedDay.length} turnos agendados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ScrollArea className="h-[calc(60vh-3.5rem)] pr-4">
                                <div className="space-y-4">
                                    {appointmentsForSelectedDay.length > 0 ? (
                                        appointmentsForSelectedDay.map(appt => (
                                            <div 
                                                key={appt.id} 
                                                className="p-3 rounded-lg bg-muted flex items-center justify-between cursor-pointer transition-all hover:shadow-md"
                                                onClick={() => setSelectedAppointment(appt)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="font-semibold text-sm w-20 text-center">
                                                        <p>{appt.time}</p>
                                                        <p className="text-muted-foreground">{getAppointmentEndTime(appt.time, appt.duration)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={appt.patientAvatarUrl} alt={appt.patientName} />
                                                            <AvatarFallback>{appt.patientName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-semibold">{appt.patientName}</p>
                                                            <p className="text-sm text-muted-foreground capitalize">{appt.type === 'checkup' ? 'Control' : appt.type === 'first_time' ? 'Primera Vez' : 'Urgencia'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`${statusStyles[appt.status]} border-none`}>{statusLabels[appt.status]}</Badge>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground h-full">
                                            <CalendarIcon className="h-12 w-12 mb-4" />
                                            <h3 className="text-lg font-semibold">No hay turnos para este día</h3>
                                            <p className="mt-1 text-sm">Selecciona otro día o agenda un nuevo turno.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <AppointmentDetailsDialog 
                    appointment={selectedAppointment}
                    open={!!selectedAppointment}
                    onOpenChange={(isOpen) => !isOpen && setSelectedAppointment(null)}
                />
            </div>
        </>
    );
}
