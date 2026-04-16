'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Patient, Appointment } from '@/types';
import { Phone, Mail, StickyNote, Calendar, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/hooks/use-toast';
import { MedicalRecordPanel, type MedicalRecord } from '@/components/medical-record-panel';

const editSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  email: z.string().email('Email inválido.').or(z.literal('')),
  phone: z.string().min(6, 'Teléfono inválido.'),
  insurance: z.string().min(1, 'Ingresá la obra social o "Particular".'),
  notes: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

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

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgencia',
};

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

function formatLastVisit(lastVisit: string | undefined): string {
  if (!lastVisit) return 'N/A';
  const d = safeDate(lastVisit);
  if (!d) return 'N/A';
  return format(d, 'dd/MM/yyyy', { locale: es });
}

type PatientDetailsDialogProps = {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: Patient) => void;
};

export function PatientDetailsDialog({ patient, open, onOpenChange, onUpdated }: PatientDetailsDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', email: '', phone: '', insurance: '', notes: '' },
  });

  useEffect(() => {
    if (patient && open) {
      form.reset({
        name: patient.name ?? '',
        email: patient.email ?? '',
        phone: patient.phone ?? '',
        insurance: patient.insurance ?? 'Particular',
        notes: patient.notes ?? '',
      });
    }
  }, [patient, open, form]);

  async function onEditSubmit(values: EditFormValues) {
    if (!user || !patient) return;
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/dashboard/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId: user.uid, id: patient.id, ...values }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Error ${res.status}`);
      }
      const updated = (await res.json()) as Patient;
      onUpdated?.(updated);
      toast({ title: 'Paciente actualizado', description: `Los datos de ${updated.name} fueron guardados.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el paciente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!open || !patient || !user?.uid) return;

    let cancelled = false;
    setLoadingAppts(true);
    setLoadingRecords(true);
    setAppointments([]);
    setRecords([]);

    // Fetch appointments
    fetchWithAuth(`/api/dashboard/appointments?professionalId=${user.uid}&patientId=${patient.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Appointment[]) => { if (!cancelled) setAppointments(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingAppts(false); });

    // Fetch medical records
    fetchWithAuth(`/api/dashboard/medical-records?professionalId=${user.uid}&patientId=${patient.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MedicalRecord[]) => { if (!cancelled) setRecords(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingRecords(false); });

    return () => { cancelled = true; };
  }, [open, patient?.id, user?.uid]);

  function handleRecordChange(updated: MedicalRecord) {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  }

  if (!patient) return null;

  const now = new Date();

  const upcoming = appointments
    .filter((a) => {
      const d = safeDate(a.date);
      return (a.status === 'pending' || a.status === 'confirmed') && d && isAfter(d, now);
    })
    .sort((a, b) => (safeDate(a.date)?.getTime() ?? 0) - (safeDate(b.date)?.getTime() ?? 0));

  const history = appointments
    .filter((a) => a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled')
    .sort((a, b) => (safeDate(b.date)?.getTime() ?? 0) - (safeDate(a.date)?.getTime() ?? 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-3xl p-0 max-h-[90svh] flex flex-col">
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b">
          {/* Mobile: compact horizontal patient strip */}
          <div className="flex items-center gap-3 md:hidden">
            <Avatar className="h-12 w-12 border shrink-0">
              <AvatarImage src={patient.avatarUrl} alt={patient.name} />
              <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-tight truncate">{patient.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">DNI: {patient.dni}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                {patient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />{patient.phone}
                  </span>
                )}
                {patient.email && (
                  <span className="flex items-center gap-1 min-w-0">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[180px]">{patient.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Desktop: original title */}
          <div className="hidden md:block">
            <DialogTitle>Ficha del Paciente</DialogTitle>
            <DialogDescription className="mt-1">
              Historial completo y detalles de {patient.name}.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {/* Mobile: stats bar */}
          <div className="md:hidden flex items-center justify-around border-b px-4 py-2 text-xs text-muted-foreground bg-muted/40">
            <div className="text-center">
              <p className="font-semibold text-foreground">{patient.totalVisits}</p>
              <p>Visitas</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <p className={cn('font-semibold', patient.missedAppointments > 2 ? 'text-destructive' : 'text-foreground')}>
                {patient.missedAppointments}
              </p>
              <p>Inasistencias</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <p className="font-semibold text-foreground">{formatLastVisit(patient.lastVisit)}</p>
              <p>Última visita</p>
            </div>
          </div>

          <div className="px-4 pb-6 pt-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

            {/* Left Column: visible only on desktop */}
            <div className="hidden md:block md:col-span-1 space-y-4">
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
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{patient.phone || '—'}</span>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="break-all leading-snug">{patient.email || '—'}</span>
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
                    <span className="font-medium">{formatLastVisit(patient.lastVisit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Visitas totales:</span>
                    <span className="font-medium">{patient.totalVisits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Inasistencias:</span>
                    <span className={cn('font-medium', patient.missedAppointments > 2 && 'text-destructive')}>
                      {patient.missedAppointments}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {patient.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StickyNote className="h-4 w-4" /> Notas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{patient.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: tabs — full width on mobile */}
            <div className="col-span-1 md:col-span-2">
              <Tabs defaultValue="turnos">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="turnos" className="flex-1">Turnos</TabsTrigger>
                  <TabsTrigger value="historial-medico" className="flex-1">Historial Médico</TabsTrigger>
                  <TabsTrigger value="editar" className="flex-1">Editar</TabsTrigger>
                </TabsList>

                {/* ── Turnos tab ── */}
                <TabsContent value="turnos" className="space-y-6 mt-0">

                  {/* Próximos turnos */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Próximos Turnos
                    </h3>
                    <div className="border rounded-md">
                      {loadingAppts ? (
                        <div className="p-4 space-y-3">
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                        </div>
                      ) : upcoming.length > 0 ? (
                        <div className="p-3 space-y-2">
                          {upcoming.map((appt) => {
                            const d = safeDate(appt.date);
                            return (
                              <div key={appt.id} className="border p-3 rounded-lg flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-sm">
                                    {d ? format(d, "dd 'de' MMMM yyyy", { locale: es }) : '—'} — {appt.time} hs
                                  </p>
                                  <p className="text-xs text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
                                </div>
                                <Badge variant="outline" className={cn('border-none shrink-0', statusStyles[appt.status])}>
                                  {statusLabels[appt.status]}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <Calendar className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          Sin próximos turnos
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Historial */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Historial de Turnos
                    </h3>
                    <div className="border rounded-md">
                      {loadingAppts ? (
                        <div className="p-4 space-y-3">
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                        </div>
                      ) : history.length > 0 ? (
                        <div className="p-3 space-y-2">
                          {history.map((appt) => {
                            const d = safeDate(appt.date);
                            const cancelledAt = appt.status === 'cancelled'
                              ? safeDate(appt.cancelledAt ?? appt.updatedAt)
                              : null;
                            return (
                              <div key={appt.id} className="border p-3 rounded-lg flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-sm">
                                    {d ? format(d, "dd 'de' MMMM yyyy", { locale: es }) : '—'} — {appt.time} hs
                                  </p>
                                  <p className="text-xs text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
                                  {cancelledAt && (
                                    <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Cancelado el {format(cancelledAt, 'dd/MM/yyyy', { locale: es })}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className={cn('border-none shrink-0', statusStyles[appt.status])}>
                                  {statusLabels[appt.status]}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <Calendar className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          Sin historial de turnos
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ── Historial Médico tab ── */}
                <TabsContent value="historial-medico" className="mt-0">
                  <MedicalRecordPanel
                    appointments={appointments}
                    records={records}
                    loading={loadingAppts || loadingRecords}
                    professionalId={user?.uid ?? ''}
                    patientId={patient.id}
                    onRecordChange={handleRecordChange}
                  />
                </TabsContent>

                {/* ── Editar tab ── */}
                <TabsContent value="editar" className="mt-0">
                  {/* DNI — read only */}
                  <div className="mb-4 px-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">DNI</p>
                    <p className="text-sm font-semibold bg-muted rounded-xl px-3 py-2 text-muted-foreground">
                      {patient.dni}
                    </p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre y Apellido</FormLabel>
                            <FormControl>
                              <Input placeholder="Juan Pérez" className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono</FormLabel>
                              <FormControl>
                                <Input placeholder="+54 9 11 1234-5678" className="rounded-xl" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="juan@example.com" type="email" className="rounded-xl" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="insurance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Obra Social / Prepaga</FormLabel>
                            <FormControl>
                              <Input placeholder="OSDE, Swiss Medical, Particular..." className="rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notas <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Alergias, condiciones relevantes, observaciones..."
                                rows={3}
                                className="resize-none rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end pt-1">
                        <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
