'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Search,
  Star,
  XCircle,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';

// ── helpers ──────────────────────────────────────────────────────────────────

const statusLabels: Record<Appointment['status'], string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

const statusStyles: Record<Appointment['status'], string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgencia',
};

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Hoy';
  if (isTomorrow(date)) return 'Mañana';
  if (isYesterday(date)) return 'Ayer';
  return format(date, "eeee d 'de' MMMM", { locale: es });
}

function canSendReminder(appt: Appointment): boolean {
  return appt.status === 'confirmed' || appt.status === 'pending';
}

function hasCompletedReview(appt: Appointment): boolean {
  return Boolean(appt.reviewSubmittedAt || appt.reviewId || appt.ratingRequestUsedAt);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecordatoriosPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingRatingId, setSendingRatingId] = useState<string | null>(null);
  const [sentRatingIds, setSentRatingIds] = useState<Set<string>>(new Set());

  // Fetch appointments for the selected day
  useEffect(() => {
    const professionalId = user?.uid;
    if (!professionalId) { setAppointments([]); return; }

    let cancelled = false;
    const day = format(selectedDate, 'yyyy-MM-dd');

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/dashboard/appointments?professionalId=${professionalId}&day=${day}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Appointment[];
        if (!cancelled) setAppointments(data);
      } catch {
        if (!cancelled) setAppointments([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.uid, selectedDate]);

  // Reset sent sets when day changes
  useEffect(() => { setSentIds(new Set()); setSentRatingIds(new Set()); }, [selectedDate]);

  // Client-side search filter — only show non-cancelled appointments
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (a.status === 'cancelled') return false;
      if (!q) return true;
      return a.patientName.toLowerCase().includes(q);
    });
  }, [appointments, search]);

  // Split into groups
  const actionable = filtered.filter(canSendReminder);
  const completed = filtered.filter((a) => a.status === 'completed');
  const rest = filtered.filter((a) => !canSendReminder(a) && a.status !== 'completed');

  async function handleSendReminder(appt: Appointment) {
    const id = appt.id || (appt as any)._id?.toString() || '';
    setSendingId(id);
    try {
      const res = await fetchWithAuth(`/api/dashboard/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reminder' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo enviar el recordatorio.' });
        return;
      }
      const data = await res.json();
      const wa = data?.whatsapp;
      if (wa?.method === 'wame' && wa?.url) {
        window.open(wa.url, '_blank', 'noopener,noreferrer');
        setSentIds((prev) => new Set(prev).add(id));
        toast({ title: 'WhatsApp abierto', description: `Recordatorio listo para enviar a ${appt.patientName}.` });
      } else if (wa?.method === 'api' && wa?.sent) {
        setSentIds((prev) => new Set(prev).add(id));
        toast({ title: 'Recordatorio enviado', description: `Mensaje enviado a ${appt.patientName}.` });
      } else {
        toast({ variant: 'destructive', title: 'Sin teléfono', description: 'El paciente no tiene número de WhatsApp registrado.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setSendingId(null);
    }
  }

  async function handleSendRatingRequest(appt: Appointment) {
    const id = appt.id || (appt as any)._id?.toString() || '';
    setSendingRatingId(id);
    try {
      const res = await fetchWithAuth(`/api/dashboard/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_rating_request' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'No se pudo enviar la solicitud de calificación.' });
        return;
      }
      const data = await res.json();
      const wa = data?.whatsapp;
      if (wa?.method === 'wame' && wa?.url) {
        window.open(wa.url, '_blank', 'noopener,noreferrer');
        setSentRatingIds((prev) => new Set(prev).add(id));
        toast({ title: 'WhatsApp abierto', description: `Solicitud de calificación lista para enviar a ${appt.patientName}.` });
      } else if (wa?.method === 'api' && wa?.sent) {
        setSentRatingIds((prev) => new Set(prev).add(id));
        toast({ title: 'Solicitud enviada', description: `Mensaje enviado a ${appt.patientName}.` });
      } else {
        toast({ variant: 'destructive', title: 'Sin teléfono', description: 'El paciente no tiene número de WhatsApp registrado.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setSendingRatingId(null);
    }
  }

  const isLoadingAll = isUserLoading || isLoading;
  const dateInputValue = format(selectedDate, 'yyyy-MM-dd');

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Recordatorios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enviá recordatorios de turno a tus pacientes por WhatsApp.</p>
      </header>

      {/* Day navigation */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Prev / Next */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl shrink-0"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 min-w-0 text-center">
              <p className="font-semibold capitalize text-sm leading-tight">
                {dayLabel(selectedDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl shrink-0"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Jump to date */}
            <Input
              type="date"
              value={dateInputValue}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(parseISO(e.target.value));
              }}
              className="h-9 w-auto rounded-xl text-sm cursor-pointer shrink-0"
            />

            {/* Today shortcut */}
            {!isToday(selectedDate) && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9 text-xs shrink-0"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoy
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre de paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl h-10"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {isLoadingAll ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mb-4" />
          <h3 className="text-lg font-semibold">
            {search ? 'Sin resultados' : 'Sin turnos para este día'}
          </h3>
          <p className="mt-1 text-sm max-w-xs">
            {search
              ? `No hay turnos que coincidan con "${search}".`
              : 'No hay turnos activos programados para esta fecha.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Actionable — pending/confirmed */}
          {actionable.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Pueden recibir recordatorio
                  <Badge variant="secondary" className="ml-auto">{actionable.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Turnos pendientes o confirmados a los que podés enviar recordatorio.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {actionable.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    isSending={sendingId === (appt.id || (appt as any)._id?.toString())}
                    wasSent={sentIds.has(appt.id || (appt as any)._id?.toString() || '')}
                    onSend={() => handleSendReminder(appt)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed — can request rating */}
          {completed.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  Solicitar calificación
                  <Badge variant="secondary" className="ml-auto">{completed.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Turnos completados. Podés pedirle al paciente que califique la atención.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {completed.map((appt) => {
                  const id = appt.id || (appt as any)._id?.toString() || '';
                  const alreadyReviewed = hasCompletedReview(appt);
                  return (
                    <AppointmentRow
                      key={appt.id}
                      appt={appt}
                      isSending={sendingRatingId === id}
                      wasSent={sentRatingIds.has(id) || Boolean(appt.ratingRequestSentAt)}
                      onSend={() => handleSendRatingRequest(appt)}
                      disabled={alreadyReviewed}
                      ratingMode
                    />
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Rest — no_show */}
          {rest.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <BellOff className="h-4 w-4" />
                  Sin acción necesaria
                  <Badge variant="outline" className="ml-auto text-muted-foreground">{rest.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {rest.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    isSending={false}
                    wasSent={false}
                    onSend={() => {}}
                    disabled
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  isSending,
  wasSent,
  onSend,
  disabled = false,
  ratingMode = false,
}: {
  appt: Appointment;
  isSending: boolean;
  wasSent: boolean;
  onSend: () => void;
  disabled?: boolean;
  ratingMode?: boolean;
}) {
  const id = appt.id || (appt as any)._id?.toString() || '';
  const patientResponse = appt.patientResponse;
  const alreadyReviewed = hasCompletedReview(appt);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-colors',
        disabled
          ? 'bg-muted/30'
          : alreadyReviewed
            ? 'bg-amber-50 dark:bg-amber-950/20'
          : patientResponse === 'confirmed'
            ? 'bg-emerald-50 dark:bg-emerald-950/30'
            : patientResponse === 'declined'
              ? 'bg-red-50 dark:bg-red-950/30'
              : 'bg-secondary/50 hover:bg-secondary',
      )}
    >
      {/* Time */}
      <span className="font-semibold text-sm w-14 text-center shrink-0 tabular-nums text-muted-foreground">
        {appt.time}
      </span>

      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={appt.patientAvatarUrl} alt={appt.patientName} />
        <AvatarFallback className="text-sm font-semibold">{appt.patientName.charAt(0)}</AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{appt.patientName}</p>
        <p className="text-xs text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={cn(
          'border-none shrink-0 text-xs hidden sm:flex',
          patientResponse === 'confirmed'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
            : patientResponse === 'declined'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              : alreadyReviewed
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : statusStyles[appt.status],
        )}
      >
        {patientResponse === 'confirmed'
          ? 'Confirmado por paciente'
          : patientResponse === 'declined'
            ? 'No asistirá'
            : alreadyReviewed
              ? 'Calificado'
            : statusLabels[appt.status]}
      </Badge>

      {/* Action button */}
      {!disabled && (
        <Button
          size="sm"
          variant={wasSent ? 'outline' : ratingMode ? 'secondary' : 'default'}
          disabled={isSending || alreadyReviewed}
          onClick={onSend}
          className={cn(
            'shrink-0 gap-1.5 h-8 text-xs rounded-lg',
            wasSent && !ratingMode && 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
            wasSent && ratingMode && 'border-yellow-300 text-yellow-700 dark:border-yellow-800 dark:text-yellow-300',
            alreadyReviewed && 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300',
          )}
        >
          {isSending ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : alreadyReviewed ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : wasSent ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : ratingMode ? (
            <Star className="h-3.5 w-3.5" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {alreadyReviewed ? 'Calificado' : wasSent ? 'Reenviado' : ratingMode ? 'Calificar' : 'Recordatorio'}
          </span>
        </Button>
      )}
    </div>
  );
}
