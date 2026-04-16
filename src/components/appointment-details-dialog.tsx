'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Appointment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Trash2, CalendarPlus, Bell, ExternalLink, CheckCircle2, UserCheck, UserX, UserMinus } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { format } from 'date-fns';

const statusLabels: { [key in Appointment['status']]: string } = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

const statusStyles: { [key in Appointment['status']]: string } = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

type AppointmentDetailsDialogProps = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated?: Appointment) => void;
  professionalName?: string;
  professionalAddress?: string;
};

export function AppointmentDetailsDialog({ appointment, open, onOpenChange, onUpdated, professionalName, professionalAddress }: AppointmentDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'reschedule'>('details');
  const [currentStatus, setCurrentStatus] = useState<Appointment['status'] | undefined>(appointment?.status);
  const [liveStatus, setLiveStatus] = useState<Appointment['status'] | undefined>(undefined);
  const [currentType, setCurrentType] = useState<Appointment['type'] | undefined>(appointment?.type);
  const [currentPatientResponse, setCurrentPatientResponse] = useState<'confirmed' | 'declined' | ''>(appointment?.patientResponse ?? '');
  const [currentNotes, setCurrentNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Reschedule tab
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [reschedulePatientConfirmed, setReschedulePatientConfirmed] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (appointment) {
      setActiveTab('details');
      setCurrentStatus(appointment.status);
      setCurrentType(appointment.type);
      setCurrentPatientResponse(appointment.patientResponse ?? '');
      setLiveStatus(undefined);
      setCurrentNotes(appointment.notes || '');
      setConfirmDelete(false);
      setReminderSent(false);
      // Pre-fill reschedule with current date/time
      const d = new Date(appointment.date as unknown as string);
      setRescheduleDate(format(d, 'yyyy-MM-dd'));
      setRescheduleTime(appointment.time || '');
      setReschedulePatientConfirmed(false);
    }
  }, [appointment, open]);

  // Fetch live status when dialog opens to avoid stale prop data
  useEffect(() => {
    if (!open || !appointment) return;
    const id = appointment.id || (appointment as any)._id?.toString() || '';
    if (!id) return;

    let cancelled = false;
    fetchWithAuth(`/api/patient/appointment/${id}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.status) {
          setLiveStatus(data.status as Appointment['status']);
          setCurrentStatus(data.status as Appointment['status']);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [open, appointment]);

  if (!appointment) return null;

  const apptId = appointment.id || (appointment as any)._id?.toString() || '';

  const apptDate = new Date(appointment.date as unknown as string);
  const [h, m] = (appointment.time || '00:00').split(':').map(Number);
  apptDate.setHours(h, m, 0, 0);

  const googleCalendarUrl = buildGoogleCalendarUrl({
    title: `Turno con ${professionalName || 'el profesional'}`,
    location: professionalAddress || '',
    startDate: apptDate,
    durationMinutes: appointment.duration || 30,
  });
  const icalUrl = `/api/dashboard/appointments/${apptId}/calendar`;

  async function handleSave() {
    const statusChanged = currentStatus !== appointment?.status;
    const typeChanged = currentType !== appointment?.type;
    const notesChanged = currentNotes !== (appointment?.notes || '');
    const patientResponseChanged = currentPatientResponse !== (appointment?.patientResponse ?? '');

    if (!apptId || (!statusChanged && !typeChanged && !notesChanged && !patientResponseChanged)) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      if (statusChanged) {
        const actionMap: Record<Appointment['status'], string> = {
          confirmed: 'confirm',
          pending: 'pending',
          cancelled: 'cancel',
          completed: 'complete',
          no_show: 'no_show',
        };
        const action = actionMap[currentStatus!];
        const response = await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            ...(typeChanged && { type: currentType }),
            ...(notesChanged && { notes: currentNotes }),
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo actualizar el turno.' });
          return;
        }
        const responseData = await response.json();
        const { whatsapp: _w, calendarLinks: _c, ...appointmentData } = responseData;

        // If patient response also changed, apply it in a second call
        if (patientResponseChanged) {
          await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', patientResponse: currentPatientResponse }),
          });
        }

        toast({ title: 'Turno actualizado', description: `Estado cambiado a "${statusLabels[currentStatus!]}".` });
        onUpdated?.(appointmentData as Appointment);
      } else {
        // No status change — update fields directly
        const response = await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            ...(typeChanged && { type: currentType }),
            ...(notesChanged && { notes: currentNotes }),
            ...(patientResponseChanged && { patientResponse: currentPatientResponse }),
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo actualizar el turno.' });
          return;
        }
        const responseData = await response.json();
        toast({ title: 'Turno actualizado' });
        onUpdated?.(responseData as Appointment);
      }
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Seleccioná fecha y horario.' });
      return;
    }
    setIsRescheduling(true);
    try {
      const body: Record<string, any> = {
        action: 'reschedule',
        date: rescheduleDate,
        time: rescheduleTime,
        duration: appointment?.duration,
      };
      if (reschedulePatientConfirmed) body.patientResponse = 'confirmed';
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
      const responseData = await response.json();
      const { googleCalendarSync: _g, ...appointmentData } = responseData;
      toast({ title: 'Turno reprogramado', description: `Movido al ${rescheduleDate} a las ${rescheduleTime} hs.` });
      onUpdated?.(appointmentData as Appointment);
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsRescheduling(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo eliminar el turno.' });
        return;
      }
      toast({ title: 'Turno eliminado', description: 'El horario quedó libre para nuevos turnos.' });
      onUpdated?.();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSendReminder() {
    setIsSendingReminder(true);
    try {
      const response = await fetchWithAuth(`/api/dashboard/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reminder' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo enviar el recordatorio.' });
        return;
      }
      const data = await response.json();
      const whatsapp = data?.whatsapp;

      if (whatsapp?.method === 'wame' && whatsapp?.url) {
        window.open(whatsapp.url, '_blank', 'noopener,noreferrer');
        setReminderSent(true);
        toast({ title: 'WhatsApp abierto', description: 'Se abrió el chat con el mensaje listo para enviar.' });
      } else if (whatsapp?.method === 'api' && whatsapp?.sent) {
        setReminderSent(true);
        toast({ title: 'Recordatorio enviado', description: 'El mensaje fue enviado por WhatsApp.' });
      } else {
        toast({ variant: 'destructive', title: 'Sin teléfono', description: 'El paciente no tiene número de WhatsApp registrado.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsSendingReminder(false);
    }
  }

  const displayStatus = liveStatus ?? appointment.status;
  const canSendReminder = displayStatus === 'pending' || displayStatus === 'confirmed';

  const isDateOrTimeChanged =
    rescheduleDate !== format(new Date(appointment.date as unknown as string), 'yyyy-MM-dd') ||
    rescheduleTime !== appointment.time;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { setConfirmDelete(false); setActiveTab('details'); } onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-md rounded-2xl gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Detalles del turno</DialogTitle>
          <DialogDescription className="text-sm mt-0.5 capitalize">
            {new Date(appointment.date as unknown as string).toLocaleDateString('es-AR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })} · {appointment.time} hs
          </DialogDescription>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'reschedule')}>
          <TabsList className="w-full rounded-none border-b border-border/40 bg-transparent h-10 p-0 gap-0">
            <TabsTrigger value="details" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-sm">
              Detalles
            </TabsTrigger>
            <TabsTrigger value="reschedule" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-sm">
              Reprogramar
            </TabsTrigger>
          </TabsList>

          {/* ── Detalles tab ── */}
          <TabsContent value="details" className="mt-0">
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Patient card */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/60">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={appointment.patientAvatarUrl} alt={appointment.patientName} />
              <AvatarFallback className="font-semibold">{appointment.patientName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold truncate">{appointment.patientName}</p>
              <p className="text-sm text-muted-foreground">Paciente</p>
            </div>
            <Badge
              variant="outline"
              className={`ml-auto border-none text-xs font-medium shrink-0 ${statusStyles[displayStatus]}`}
            >
              {statusLabels[displayStatus]}
            </Badge>
          </div>

          {/* Status selector */}
          <div className="space-y-1.5">
            <Label htmlFor="status-select" className="text-sm font-medium">Cambiar estado</Label>
            <Select
              value={currentStatus}
              onValueChange={(v) => {
                const next = v as Appointment['status'];
                setCurrentStatus(next);
                // Clear patient response when status no longer shows that section
                if (next === 'cancelled' || next === 'no_show' || next === 'completed') {
                  setCurrentPatientResponse('');
                }
              }}
            >
              <SelectTrigger id="status-select" className="rounded-xl h-10">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(statusLabels).map(([status, label]) => (
                  <SelectItem key={status} value={status} className="rounded-lg">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type selector */}
          <div className="space-y-1.5">
            <Label htmlFor="type-select" className="text-sm font-medium">Tipo de consulta</Label>
            <Select
              value={currentType}
              disabled={currentStatus === 'cancelled'}
              onValueChange={(v) => setCurrentType(v as Appointment['type'])}
            >
              <SelectTrigger id="type-select" className="rounded-xl h-10">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="first_time" className="rounded-lg">Primera vez</SelectItem>
                <SelectItem value="checkup" className="rounded-lg">Control</SelectItem>
                <SelectItem value="urgent" className="rounded-lg">Urgencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Patient response — only shown for active/upcoming appointments */}
          {currentStatus !== 'cancelled' && currentStatus !== 'no_show' && currentStatus !== 'completed' && (() => {
            const options = [
              { value: '' as const, label: 'Sin respuesta', Icon: UserMinus, active: 'bg-secondary text-foreground border-border' },
              { value: 'confirmed' as const, label: 'Confirmó', Icon: UserCheck, active: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
              { value: 'declined' as const, label: 'No asistirá', Icon: UserX, active: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' },
            ];
            return (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Respuesta del paciente</Label>
                <div className={`grid gap-1.5 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {options.map(({ value, label, Icon, active }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCurrentPatientResponse(value)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        currentPatientResponse === value
                          ? active
                          : 'bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm font-medium">Notas de la Consulta</Label>
            <Textarea
              id="notes"
              placeholder="Añadir notas privadas sobre la consulta..."
              value={currentNotes}
              onChange={(e) => setCurrentNotes(e.target.value)}
              className="min-h-[90px] rounded-xl resize-none"
            />
          </div>

          {/* WhatsApp reminder */}
          {canSendReminder && (
            <div className="rounded-2xl border border-border/50 bg-secondary/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Recordatorio por WhatsApp</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Envía al paciente la fecha, hora y enlace para confirmar asistencia.
                  </p>
                </div>
                {reminderSent && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
              </div>
              <Button
                variant={reminderSent ? 'outline' : 'default'}
                size="sm"
                className="gap-1.5 w-full rounded-xl h-9"
                onClick={handleSendReminder}
                disabled={isSendingReminder || isDeleting || isSaving}
              >
                {isSendingReminder ? (
                  <><Bell className="h-3.5 w-3.5 animate-pulse" />Enviando...</>
                ) : reminderSent ? (
                  <><ExternalLink className="h-3.5 w-3.5" />Reenviar recordatorio</>
                ) : (
                  <><Bell className="h-3.5 w-3.5" />Enviar recordatorio</>
                )}
              </Button>
            </div>
          )}

          {/* Calendar links */}
          <div className="grid grid-cols-2 gap-2">
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs rounded-xl h-9">
                <CalendarPlus className="h-3.5 w-3.5" /> Calendario de Google
              </Button>
            </a>
            <a href={icalUrl}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs rounded-xl h-9">
                <CalendarPlus className="h-3.5 w-3.5" /> Apple / Outlook
              </Button>
            </a>
          </div>

          {/* Delete confirmation warning */}
          {confirmDelete && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive leading-relaxed">
              ¿Confirmar eliminación? El turno se borrará y el horario quedará libre.
            </div>
          )}
        </div>

        {/* Details footer */}
        <div className="px-6 py-4 border-t border-border/40 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 hover:border-destructive/60 sm:mr-auto rounded-xl h-9"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? (isDeleting ? 'Eliminando...' : 'Confirmar') : 'Eliminar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving || isDeleting} className="rounded-xl h-9">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || isDeleting} className="rounded-xl h-9">
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
          </TabsContent>

          {/* ── Reprogramar tab ── */}
          <TabsContent value="reschedule" className="mt-0">
            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Patient reminder */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-secondary/60">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={appointment.patientAvatarUrl} alt={appointment.patientName} />
                  <AvatarFallback className="font-semibold text-sm">{appointment.patientName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate text-sm">{appointment.patientName}</p>
                  <p className="text-xs text-muted-foreground">Turno actual: {appointment.time} hs</p>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-date" className="text-sm font-medium">Nueva fecha</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>

              {/* Time */}
              <div className="space-y-1.5">
                <Label htmlFor="reschedule-time" className="text-sm font-medium">Nuevo horario</Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>

              {/* Patient confirmed checkbox */}
              <label htmlFor="reschedule-patient-confirmed" className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  id="reschedule-patient-confirmed"
                  checked={reschedulePatientConfirmed}
                  onCheckedChange={(v) => setReschedulePatientConfirmed(!!v)}
                  className="mt-0.5 shrink-0"
                />
                <div className="text-sm leading-snug">
                  <span className="font-medium group-hover:text-foreground transition-colors">El paciente confirmó el nuevo horario</span>
                  <p className="text-xs text-muted-foreground mt-0.5">El turno quedará marcado como confirmado por el paciente.</p>
                </div>
              </label>
            </div>

            {/* Reschedule footer */}
            <div className="px-6 py-4 border-t border-border/40 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isRescheduling} className="sm:mr-auto rounded-xl h-9">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleReschedule}
                disabled={isRescheduling || !rescheduleDate || !rescheduleTime || !isDateOrTimeChanged}
                className="rounded-xl h-9"
              >
                {isRescheduling ? (
                  <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />Reprogramando...</>
                ) : 'Confirmar reprogramación'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
