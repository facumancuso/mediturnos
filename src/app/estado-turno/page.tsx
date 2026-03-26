'use client';

import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileSearch,
  MinusCircle,
  Phone,
  Search,
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

type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';

type AppointmentDto = {
  id: string;
  date: string;
  time: string;
  type: string;
  status: AppointmentStatus;
};

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
    label: 'Pendiente',
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

export default function EstadoTurnoPage() {
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [data, setData] = useState<LookupResponse | null>(null);

  const sortedAppointments = useMemo(() => {
    if (!data?.appointments?.length) return [];
    return [...data.appointments].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return diff !== 0 ? diff : a.time.localeCompare(b.time);
    });
  }, [data]);

  async function handleSearch() {
    setError('');
    setData(null);
    if (!fullName.trim() || !dni.trim() || !phone.trim()) {
      setError('Completá nombre, DNI y teléfono para continuar.');
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        fullName: fullName.trim(),
        dni: dni.trim(),
        phone: phone.trim(),
      });
      const response = await fetch(`/api/patient/appointments?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error || 'No se pudieron obtener los turnos.');
        return;
      }
      setData(payload as LookupResponse);
    } catch (requestError) {
      console.error(requestError);
      setError('Ocurrió un error inesperado buscando los turnos.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAction(appointmentId: string, action: 'confirm' | 'cancel') {
    setError('');
    setIsUpdatingId(appointmentId);
    try {
      const response = await fetch('/api/patient/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          action,
          fullName: fullName.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error || 'No se pudo actualizar el turno.');
        return;
      }
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          appointments: current.appointments.map((apt) =>
            apt.id === appointmentId
              ? { ...apt, status: payload.status as AppointmentStatus }
              : apt
          ),
        };
      });
    } catch (requestError) {
      console.error(requestError);
      setError('Ocurrió un error inesperado al actualizar el turno.');
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">

        {/* ── HERO ────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-14 md:py-20">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
          />
          <div
            aria-hidden
            className="absolute top-0 right-0 -z-10 w-96 h-96 bg-sky-200/20 rounded-full blur-3xl"
          />
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FileSearch className="h-8 w-8 text-primary" />
              </div>
              <Badge
                variant="outline"
                className="mb-4 border-primary/40 bg-primary/5 text-primary font-semibold px-3 py-1"
              >
                Para Pacientes
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Consultá el estado de tu turno
              </h1>
              <p className="mt-4 text-muted-foreground md:text-lg">
                Ingresá tus datos para ver tus turnos, confirmarlos o cancelarlos en tiempo real.
              </p>
            </div>
          </div>
        </section>

        {/* ── FORM + RESULTS ──────────────────────────────── */}
        <section className="pb-20 md:pb-28">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl space-y-6">

              {/* Search form card */}
              <Card className="shadow-lg border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="h-5 w-5 text-primary" />
                    Buscar mis turnos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="flex items-center gap-1.5 text-sm font-medium">
                        <User className="h-3.5 w-3.5 text-primary" /> Nombre completo
                      </Label>
                      <Input
                        id="fullName"
                        placeholder="Ej: Juan Pérez"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dni" className="flex items-center gap-1.5 text-sm font-medium">
                        <FileSearch className="h-3.5 w-3.5 text-primary" /> DNI
                      </Label>
                      <Input
                        id="dni"
                        placeholder="Ej: 30111222"
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5 text-sm font-medium">
                        <Phone className="h-3.5 w-3.5 text-primary" /> Teléfono
                      </Label>
                      <Input
                        id="phone"
                        placeholder="Ej: +54 11 5555-2000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="gap-2 px-6"
                      size="lg"
                    >
                      {isSearching ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" /> Consultar turnos
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              {data && (
                <div className="space-y-4">
                  {/* Patient info banner */}
                  <div className="flex items-center gap-4 rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
                    <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{data.patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        DNI: {data.patient.dni} · Tel: {data.patient.phone}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
                      {sortedAppointments.length} turno{sortedAppointments.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {/* Appointment cards */}
                  {sortedAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {sortedAppointments.map((appointment) => {
                        const config = statusConfig[appointment.status];
                        const StatusIcon = config.Icon;
                        const canUpdate =
                          appointment.status === 'pending' || appointment.status === 'confirmed';
                        const dateLabel = new Date(appointment.date).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        });

                        return (
                          <div
                            key={appointment.id}
                            className={`rounded-xl border border-l-4 bg-card shadow-sm p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-shadow hover:shadow-md ${config.borderClass}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 shrink-0 ${config.iconClass}`}>
                                <StatusIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold capitalize">{dateLabel}</p>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> {appointment.time} hs
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> {appointment.type}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 md:items-end">
                              <Badge
                                variant="outline"
                                className={`border text-xs font-semibold ${config.badgeClass}`}
                              >
                                {config.label}
                              </Badge>

                              {canUpdate && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isUpdatingId === appointment.id}
                                    onClick={() => handleAction(appointment.id, 'confirm')}
                                    className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    {isUpdatingId === appointment.id ? (
                                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isUpdatingId === appointment.id}
                                    onClick={() => handleAction(appointment.id, 'cancel')}
                                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                                  >
                                    {isUpdatingId === appointment.id ? (
                                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5" />
                                    )}
                                    Cancelar
                                  </Button>
                                </div>
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

              {/* Info section — shown while no results */}
              {!data && !isSearching && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-6">
                  <p className="text-sm font-semibold text-muted-foreground mb-4 text-center">
                    ¿Cómo funciona?
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        icon: User,
                        title: 'Ingresá tus datos',
                        desc: 'Nombre completo, DNI y teléfono con los que te registró el profesional.',
                      },
                      {
                        icon: Search,
                        title: 'Consultá tus turnos',
                        desc: 'Ves todos los turnos asociados a tu perfil con fecha, hora y tipo.',
                      },
                      {
                        icon: CheckCircle2,
                        title: 'Confirmá o cancelá',
                        desc: 'Podés confirmar o cancelar turnos pendientes directamente desde acá.',
                      },
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
          </div>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
}
