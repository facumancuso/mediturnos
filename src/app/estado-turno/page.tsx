'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileSearch,
  MapPin,
  MinusCircle,
  Search,
  Smartphone,
  User,
  XCircle,
} from 'lucide-react';

import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildGoogleCalendarUrl } from '@/lib/calendar';

type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';

type AppointmentDto = {
  id: string;
  date: string;
  time: string;
  duration?: number;
  type: string;
  status: AppointmentStatus;
  patientResponse?: 'confirmed' | 'declined' | null;
  patientRespondedAt?: string | null;
  reminderSentAt?: string | null;
  patientName?: string;
  professionalName?: string | null;
  professionalAddress?: string | null;
  professionalWhatsappNumber?: string | null;
  professionalSlug?: string | null;
  professionalMapUrl?: string | null;
};

function formatAppointmentDateLabel(date: string) {
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function buildProfessionalWhatsAppUrl(appointment: AppointmentDto) {
  const phone = String(appointment.professionalWhatsappNumber || '').replace(/\D/g, '');
  if (!phone) return null;

  const dateLabel = formatAppointmentDateLabel(appointment.date);
  const typeLabel = typeLabels[appointment.type] ?? appointment.type;
  const message =
    `Hola ${appointment.professionalName || ''}, necesito ayuda con mi turno.%0A%0A` +
    `Paciente: ${appointment.patientName || 'Paciente'}%0A` +
    `Fecha: ${dateLabel}%0A` +
    `Hora: ${appointment.time} hs%0A` +
    `Tipo: ${typeLabel}%0A` +
    `Ubicación: ${appointment.professionalAddress || 'Sin dirección cargada'}%0A%0A` +
    `¿Podrían recordarme los detalles del turno?`;

  return `https://wa.me/${phone}?text=${message}`;
}

function buildProfessionalProfileUrl(appointment: AppointmentDto) {
  const slug = String(appointment.professionalSlug || '').trim();
  if (!slug) return null;
  return `/profesional/${slug}`;
}

function buildProfessionalMapsUrl(appointment: AppointmentDto) {
  const explicitMapUrl = String(appointment.professionalMapUrl || '').trim();
  if (explicitMapUrl) return explicitMapUrl;

  const address = String(appointment.professionalAddress || '').trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildCalendarLinks(appointment: AppointmentDto) {
  const startDate = new Date(appointment.date);
  const [h, m] = (appointment.time || '00:00').split(':').map(Number);
  startDate.setHours(h, m, 0, 0);
  const title = `Turno con ${appointment.professionalName || 'el profesional'}`;
  const googleUrl = buildGoogleCalendarUrl({
    title,
    location: appointment.professionalAddress || '',
    startDate,
    durationMinutes: appointment.duration || 30,
  });
  const icalUrl = `/api/dashboard/appointments/${appointment.id}/calendar`;
  return { googleUrl, icalUrl };
}

type LookupResponse = {
  patient: {
    id: string;
    name: string;
    dni: string;
    phone: string;
  };
  appointments: AppointmentDto[];
};

const statusConfig: Record<
  AppointmentStatus,
  { label: string; badgeClass: string; borderClass: string; Icon: React.ElementType; iconClass: string }
> = {
  confirmed: {
    label: 'Confirmado',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    borderClass: 'border-l-sky-500',
    Icon: CheckCircle2,
    iconClass: 'text-sky-500',
  },
  pending: {
    label: 'Pendiente de confirmación',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    borderClass: 'border-l-amber-500',
    Icon: Clock,
    iconClass: 'text-amber-500',
  },
  completed: {
    label: 'Completado',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    borderClass: 'border-l-emerald-500',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
  cancelled: {
    label: 'Cancelado',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    borderClass: 'border-l-red-400',
    Icon: XCircle,
    iconClass: 'text-red-400',
  },
  no_show: {
    label: 'No asistió',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    borderClass: 'border-l-slate-400',
    Icon: MinusCircle,
    iconClass: 'text-slate-400',
  },
};

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgente',
};

// ── Direct appointment view (from reminder link) ──────────────────────────────

function DirectAppointmentView({ appointmentId }: { appointmentId: string }) {
  const [appointment, setAppointment] = useState<AppointmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/patient/appointment/${appointmentId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setAppointment(data);
      })
      .catch(() => setError('No se pudo cargar el turno.'))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  async function handleAction(action: 'confirm' | 'cancel') {
    setIsUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/patient/appointment/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo actualizar el turno.'); return; }
      setAppointment(data);
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Cargando turno...
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="mx-auto max-w-md">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-destructive">
          <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">No se pudo cargar el turno</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) return null;

  const config = statusConfig[appointment.status];
  const StatusIcon = config.Icon;
  const dateLabel = formatAppointmentDateLabel(appointment.date);
  const patientAlreadyResponded = !!appointment.patientResponse;
  const canConfirm = appointment.status === 'confirmed' && !patientAlreadyResponded;
  const canCancel = appointment.status === 'confirmed' && !patientAlreadyResponded;
  const professionalWhatsAppUrl = buildProfessionalWhatsAppUrl(appointment);
  const professionalProfileUrl = buildProfessionalProfileUrl(appointment);
  const professionalMapsUrl = buildProfessionalMapsUrl(appointment);

  const badgeClass =
    appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : config.badgeClass;
  const badgeLabel =
    appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed'
      ? 'Confirmado por paciente'
      : config.label;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Appointment card */}
      <div className={`rounded-2xl border border-l-4 bg-card shadow-md p-6 ${config.borderClass}`}>
        <div className="flex items-start gap-3 mb-5">
          <div className={`mt-1 shrink-0 ${config.iconClass}`}>
            <StatusIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            {appointment.patientName && (
              <p className="font-semibold text-lg leading-tight">{appointment.patientName}</p>
            )}
            <p className="font-medium capitalize mt-0.5">{dateLabel}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {appointment.time} hs
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {typeLabels[appointment.type] ?? appointment.type}
              </span>
            </div>
            {(appointment.professionalName || appointment.professionalAddress) && (
              <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                {appointment.professionalName && (
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    {professionalProfileUrl ? (
                      <Link href={professionalProfileUrl} className="text-primary hover:underline">
                        {appointment.professionalName}
                      </Link>
                    ) : (
                      <span>{appointment.professionalName}</span>
                    )}
                  </p>
                )}
                {appointment.professionalAddress && (
                  <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    {professionalMapsUrl ? (
                      <a href={professionalMapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {appointment.professionalAddress}
                      </a>
                    ) : (
                      <span>{appointment.professionalAddress}</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
          <Badge variant="outline" className={`border text-xs font-semibold shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </Badge>
        </div>

        {/* Actions */}
        {(canConfirm || canCancel) && (
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            {canConfirm && (
              <Button
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isUpdating}
                onClick={() => handleAction('confirm')}
              >
                {isUpdating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar asistencia
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50"
                disabled={isUpdating}
                onClick={() => handleAction('cancel')}
              >
                {isUpdating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                No puedo asistir
              </Button>
            )}
          </div>
        )}

        {/* Resolved state */}
        {appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed' && (() => {
          const { googleUrl, icalUrl } = buildCalendarLinks(appointment);
          return (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Tu asistencia fue confirmada. ¡Te esperamos!
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9 rounded-xl">
                    <CalendarPlus className="h-3.5 w-3.5" /> Google Calendar
                  </Button>
                </a>
                <a href={icalUrl}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-9 rounded-xl">
                    <Smartphone className="h-3.5 w-3.5" /> iPhone / Outlook
                  </Button>
                </a>
              </div>
            </div>
          );
        })()}
        {appointment.status === 'confirmed' && appointment.patientResponse === 'declined' && (
          <div className="flex items-center gap-2 pt-4 border-t text-red-600 text-sm font-medium">
            <XCircle className="h-4 w-4" />
            Registramos que no podés asistir. El profesional ya fue notificado.
          </div>
        )}
        {appointment.status === 'cancelled' && (
          <div className="flex items-center gap-2 pt-4 border-t text-red-600 text-sm font-medium">
            <XCircle className="h-4 w-4" />
            El turno fue cancelado. Podés solicitar un nuevo turno cuando quieras.
          </div>
        )}
        {(appointment.status === 'completed' || appointment.status === 'no_show') && (
          <div className="pt-4 border-t text-muted-foreground text-sm">
            Este turno ya finalizó y no puede modificarse.
          </div>
        )}

        {professionalWhatsAppUrl && (
          <div className="pt-4 border-t">
            <a href={professionalWhatsAppUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2 border-green-300 text-green-700 hover:bg-green-50">
                <Smartphone className="h-4 w-4" /> Consultar por WhatsApp
              </Button>
            </a>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}

// ── DNI search view (original flow) ──────────────────────────────────────────

function DniSearchView() {
  const [dni, setDni] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState<LookupResponse | null>(null);

  const sortedAppointments = useMemo(() => {
    if (!data?.appointments?.length) return [];
    return [...data.appointments].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return diff !== 0 ? diff : b.time.localeCompare(a.time);
    });
  }, [data]);

  async function handleSearch() {
    setError('');
    setData(null);
    if (!dni.trim()) { setError('Ingresá tu DNI para continuar.'); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/patient/appointments?dni=${dni.trim()}&activeOnly=1`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) { setError(payload?.error || 'No se pudieron obtener los turnos.'); return; }
      setData(payload as LookupResponse);
    } catch {
      setError('Ocurrió un error inesperado buscando los turnos.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAction(appointmentId: string, action: 'confirm' | 'cancel') {
    setError('');
    setIsUpdatingId(appointmentId);
    try {
      const res = await fetch('/api/patient/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action, dni: dni.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) { setError(payload?.error || 'No se pudo actualizar el turno.'); return; }
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          appointments: current.appointments
            .map((apt) => (apt.id === appointmentId ? { ...apt, status: payload.status as AppointmentStatus } : apt))
            .filter((apt) => apt.status === 'pending' || apt.status === 'confirmed'),
        };
      });
    } catch {
      setError('Ocurrió un error inesperado al actualizar el turno.');
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="shadow-lg border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" /> Buscar mis turnos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dni" className="flex items-center gap-1.5 text-sm font-medium">
              <FileSearch className="h-3.5 w-3.5 text-primary" /> DNI (sin puntos)
            </Label>
            <div className="flex gap-3">
              <Input
                id="dni"
                name="dni"
                type="text"
                placeholder="Ej: 30111222"
                value={dni}
                autoComplete="off"
                inputMode="numeric"
                spellCheck={false}
                onChange={(e) => setDni(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-11"
              />
              <Button onClick={handleSearch} disabled={isSearching} className="gap-2 px-6 shrink-0" size="lg">
                {isSearching ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Buscando...</>
                ) : (
                  <><Search className="h-4 w-4" /> Consultar</>
                )}
              </Button>
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
            <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{data.patient.name}</p>
              <p className="text-sm text-muted-foreground">DNI: {data.patient.dni} · Tel: {data.patient.phone}</p>
            </div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
              {sortedAppointments.length} turno{sortedAppointments.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {sortedAppointments.length > 0 ? (
            <div className="space-y-3">
              {sortedAppointments.map((appointment) => {
                const config = statusConfig[appointment.status];
                const StatusIcon = config.Icon;
                const patientAlreadyResponded = !!appointment.patientResponse;
                const canConfirm = appointment.status === 'confirmed' && !patientAlreadyResponded;
                const canCancel = appointment.status === 'confirmed' && !patientAlreadyResponded;
                const isUpdating = isUpdatingId === appointment.id;
                const dateLabel = formatAppointmentDateLabel(appointment.date);
                const badgeClass =
                  appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : config.badgeClass;
                const badgeLabel =
                  appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed'
                    ? 'Confirmado por paciente'
                    : config.label;
                const professionalWhatsAppUrl = buildProfessionalWhatsAppUrl(appointment);
                const professionalProfileUrl = buildProfessionalProfileUrl(appointment);
                const professionalMapsUrl = buildProfessionalMapsUrl(appointment);

                return (
                  <div key={appointment.id} className={`rounded-xl border border-l-4 bg-card shadow-sm p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-shadow hover:shadow-md ${config.borderClass}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${config.iconClass}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{dateLabel}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {appointment.time} hs</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {typeLabels[appointment.type] ?? appointment.type}</span>
                        </div>
                        {(appointment.professionalName || appointment.professionalAddress) && (
                          <div className="mt-2 space-y-1 text-sm">
                            {appointment.professionalName && (
                              <p className="flex items-center gap-1.5 font-medium text-foreground">
                                <User className="h-3.5 w-3.5 text-primary" />
                                {professionalProfileUrl ? (
                                  <Link href={professionalProfileUrl} className="text-primary hover:underline">
                                    {appointment.professionalName}
                                  </Link>
                                ) : (
                                  <span>{appointment.professionalName}</span>
                                )}
                              </p>
                            )}
                            {appointment.professionalAddress && (
                              <p className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                {professionalMapsUrl ? (
                                  <a href={professionalMapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {appointment.professionalAddress}
                                  </a>
                                ) : (
                                  <span>{appointment.professionalAddress}</span>
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:items-end">
                      <Badge variant="outline" className={`border text-xs font-semibold ${badgeClass}`}>
                        {badgeLabel}
                      </Badge>
                      {(canConfirm || canCancel) && (
                        <div className="flex gap-2">
                          {canConfirm && (
                            <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => handleAction(appointment.id, 'confirm')} className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                              {isUpdating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Asisto al turno
                            </Button>
                          )}
                          {canCancel && (
                            <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => handleAction(appointment.id, 'cancel')} className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
                              {isUpdating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <XCircle className="h-3.5 w-3.5" />}
                              No asisto al turno
                            </Button>
                          )}
                        </div>
                      )}
                      {appointment.status === 'confirmed' && appointment.patientResponse === 'confirmed' && (() => {
                        const { googleUrl, icalUrl } = buildCalendarLinks(appointment);
                        return (
                          <div className="flex gap-2">
                            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-border/60">
                                <CalendarPlus className="h-3.5 w-3.5" /> Google
                              </Button>
                            </a>
                            <a href={icalUrl}>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-border/60">
                                <Smartphone className="h-3.5 w-3.5" /> iPhone
                              </Button>
                            </a>
                          </div>
                        );
                      })()}
                      {professionalWhatsAppUrl && (
                        <a href={professionalWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-green-300 text-green-700 hover:bg-green-50">
                            <Smartphone className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 py-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-muted-foreground">No hay turnos registrados para estos datos.</p>
            </div>
          )}
        </div>
      )}

      {!data && !isSearching && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-6">
          <p className="text-sm font-semibold text-muted-foreground mb-4 text-center">¿Cómo funciona?</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: User, title: 'Ingresá tu DNI', desc: 'Solo necesitás el número de DNI con el que te registró el profesional.' },
              { icon: Search, title: 'Consultá tus turnos', desc: 'Ves todos los turnos asociados a tu perfil con fecha, hora y tipo.' },
              { icon: CheckCircle2, title: 'Confirmá o cancelá', desc: 'Podés confirmar o cancelar turnos pendientes directamente desde acá.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EstadoTurnoPage() {
  const searchParams = useSearchParams();
  const turnoId = searchParams.get('turno');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">

        <section className="relative overflow-hidden py-14 md:py-20">
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
          <div aria-hidden className="absolute top-0 right-0 -z-10 w-96 h-96 bg-sky-200/20 rounded-full blur-3xl" />
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FileSearch className="h-8 w-8 text-primary" />
              </div>
              <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/5 text-primary font-semibold px-3 py-1">
                Para Pacientes
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                {turnoId ? 'Tu turno' : 'Consultá el estado de tu turno'}
              </h1>
              <p className="mt-4 text-muted-foreground md:text-lg">
                {turnoId
                  ? 'Confirmá tu asistencia o avisanos si no podés venir.'
                  : 'Ingresá tu DNI para ver tus turnos, confirmarlos o cancelarlos en tiempo real.'}
              </p>
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="container px-4 md:px-6">
            {turnoId ? <DirectAppointmentView appointmentId={turnoId} /> : <DniSearchView />}
          </div>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
}
