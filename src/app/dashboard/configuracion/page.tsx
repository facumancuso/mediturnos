'use client';

import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, CalendarX, X } from "lucide-react";
import * as React from "react";
import { startOfDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import QRCode from "react-qr-code";
import { useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { parseWorkingHoursConfig, WEEKDAY_KEYS, type WeekdayKey, type WorkingDayConfig } from "@/lib/working-hours";

const DAY_LABELS: Record<WeekdayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DEFAULT_CARD_THEME = {
  primaryColor: '#0d6efd',
  accentColor: '#0f172a',
  backgroundColor: '#ffffff',
};

export default function SettingsPage() {
  const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
    const [isWhatsAppConnected, setIsWhatsAppConnected] = React.useState(false);
  const [isGoogleStatusLoading, setIsGoogleStatusLoading] = React.useState(false);
  const [isGoogleConnecting, setIsGoogleConnecting] = React.useState(false);
  const [isGoogleDisconnecting, setIsGoogleDisconnecting] = React.useState(false);
  const [isGoogleAvailable, setIsGoogleAvailable] = React.useState(true);
  const [googleEmail, setGoogleEmail] = React.useState<string>('');
  const [googleCalendarId, setGoogleCalendarId] = React.useState<string>('');
    const [widgetColor, setWidgetColor] = React.useState("#0d6efd");
    const [origin, setOrigin] = React.useState('');
    const [isClient, setIsClient] = React.useState(false);
    const [mfaEnabled, setMfaEnabled] = React.useState(false);
    const [mfaSetupUrl, setMfaSetupUrl] = React.useState('');
    const [mfaCode, setMfaCode] = React.useState('');
    const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
    const [isLoadingMfaStatus, setIsLoadingMfaStatus] = React.useState(false);
    const [isStartingMfaSetup, setIsStartingMfaSetup] = React.useState(false);
    const [isConfirmingMfa, setIsConfirmingMfa] = React.useState(false);
    const [isLoadingSchedule, setIsLoadingSchedule] = React.useState(false);
    const [isSavingSchedule, setIsSavingSchedule] = React.useState(false);
    const [isSavingTheme, setIsSavingTheme] = React.useState(false);
    const [blockedDates, setBlockedDates] = React.useState<string[]>([]);
    const [selectedBlockedDates, setSelectedBlockedDates] = React.useState<Date[]>([]);
    const [isSavingBlockedDates, setIsSavingBlockedDates] = React.useState(false);
    const [confirmBlockedDatesOpen, setConfirmBlockedDatesOpen] = React.useState(false);
    const [professionalId, setProfessionalId] = React.useState('');
    const [appointmentDuration, setAppointmentDuration] = React.useState('30');
    const [workingDays, setWorkingDays] = React.useState<Record<WeekdayKey, WorkingDayConfig>>(() =>
      parseWorkingHoursConfig(JSON.stringify({}), 30).days
    );
    const [cardTheme, setCardTheme] = React.useState(DEFAULT_CARD_THEME);
    const searchParams = useSearchParams();
    const auth = useAuth();
    const { user } = useUser();
    const { toast } = useToast();

    const callbackStatus = searchParams.get('status');
    const callbackIntegration = searchParams.get('integration');
    const callbackMessage = searchParams.get('message');
    const googleRequired = searchParams.get('googleRequired');

    React.useEffect(() => {
      if (callbackIntegration !== 'google' || !callbackStatus) return;

      if (callbackStatus === 'connected') {
        toast({ title: 'Google Calendar conectado', description: 'La integración quedó activa.' });
      } else if (callbackStatus === 'error') {
        toast({
          variant: 'destructive',
          title: 'Error de conexión',
          description: callbackMessage || 'No se pudo conectar Google Calendar.',
        });
      }
    }, [callbackIntegration, callbackMessage, callbackStatus, toast]);

    React.useEffect(() => {
      if (googleRequired !== '1') return;

      toast({
        title: 'Conexión obligatoria',
        description: 'Para continuar usando el dashboard, conecta tu Google Calendar.',
      });
    }, [googleRequired, toast]);

    const loadGoogleStatus = React.useCallback(async () => {
      try {
        setIsGoogleStatusLoading(true);
        const response = await fetchWithAuth('/api/dashboard/integrations/google/status', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('No se pudo obtener estado de Google Calendar.');
        }

        const data = (await response.json()) as {
          connected?: boolean;
          email?: string;
          calendarId?: string;
          available?: boolean;
        };

        setIsGoogleConnected(!!data.connected);
        setIsGoogleAvailable(data.available !== false);
        setGoogleEmail(data.email || '');
        setGoogleCalendarId(data.calendarId || '');
      } catch (error) {
        console.error(error);
      } finally {
        setIsGoogleStatusLoading(false);
      }
    }, []);

    React.useEffect(() => {
        // This will only run on the client, after hydration
        setIsClient(true);
        setOrigin(window.location.origin);
    }, []);

    React.useEffect(() => {
      let cancelled = false;

      async function loadMfaStatus() {
        if (!auth.currentUser) return;
        try {
          setIsLoadingMfaStatus(true);
          const idToken = await auth.currentUser.getIdToken(true);
          const response = await fetch('/api/auth/mfa/status', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (!response.ok) {
            throw new Error('No se pudo consultar estado MFA.');
          }

          const data = (await response.json()) as { enabled: boolean };
          if (!cancelled) {
            setMfaEnabled(!!data.enabled);
          }
        } catch (error) {
          console.error(error);
        } finally {
          if (!cancelled) {
            setIsLoadingMfaStatus(false);
          }
        }
      }

      loadMfaStatus();

      return () => {
        cancelled = true;
      };
    }, [auth.currentUser]);

    React.useEffect(() => {
      const uid = user?.uid;
      if (!uid) return;

      let cancelled = false;

      async function loadProfessionalSchedule() {
        try {
          setIsLoadingSchedule(true);
          const response = await fetchWithAuth(`/api/dashboard/professional?professionalId=${uid}`, {
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error('No se pudo cargar la configuración de horarios.');
          }

          const professional = (await response.json()) as {
            id?: string;
            userId?: string;
            appointmentDuration?: number;
            workingHours?: string;
            blockedDates?: string[];
            publicProfile?: {
              cardTheme?: {
                primaryColor?: string;
                accentColor?: string;
                backgroundColor?: string;
              };
            };
          };

          if (cancelled) return;

          const parsed = parseWorkingHoursConfig(
            professional.workingHours,
            professional.appointmentDuration || 30
          );

          setProfessionalId(String(professional.id || professional.userId || uid));
          setAppointmentDuration(String(parsed.appointmentDuration));
          setWorkingDays(parsed.days);
          const incomingBlockedDates = Array.isArray(professional.blockedDates)
            ? professional.blockedDates.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
            : [];
          setBlockedDates(incomingBlockedDates);
          setSelectedBlockedDates(incomingBlockedDates.map((d) => new Date(`${d}T12:00:00`)));
          setCardTheme({
            primaryColor: professional.publicProfile?.cardTheme?.primaryColor || DEFAULT_CARD_THEME.primaryColor,
            accentColor: professional.publicProfile?.cardTheme?.accentColor || DEFAULT_CARD_THEME.accentColor,
            backgroundColor: professional.publicProfile?.cardTheme?.backgroundColor || DEFAULT_CARD_THEME.backgroundColor,
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudieron cargar tus horarios actuales.',
          });
        } finally {
          if (!cancelled) {
            setIsLoadingSchedule(false);
          }
        }
      }

      loadProfessionalSchedule();
      void loadGoogleStatus();

      return () => {
        cancelled = true;
      };
    }, [loadGoogleStatus, user?.uid, toast]);

    const handleConnectGoogle = async () => {
      try {
        setIsGoogleConnecting(true);
        const response = await fetchWithAuth('/api/dashboard/integrations/google/connect', {
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
            missing?: string[];
          };

          if (payload.code === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
            const missing = Array.isArray(payload.missing) ? payload.missing.join(', ') : '';
            throw new Error(
              missing
                ? `Google OAuth no está configurado. Variables faltantes: ${missing}.`
                : 'Google OAuth no está configurado en el servidor.'
            );
          }

          throw new Error(payload.error || 'No se pudo iniciar conexión con Google Calendar.');
        }

        const payload = (await response.json()) as { authUrl?: string };
        if (!payload.authUrl) {
          throw new Error('Google no devolvió URL de autorización.');
        }

        window.location.href = payload.authUrl;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'No se pudo conectar Google Calendar.',
        });
        setIsGoogleConnecting(false);
      }
    };

    const handleDisconnectGoogle = async () => {
      try {
        setIsGoogleDisconnecting(true);
        const response = await fetchWithAuth('/api/dashboard/integrations/google/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('No se pudo desconectar Google Calendar.');
        }

        setIsGoogleConnected(false);
        setGoogleEmail('');
        setGoogleCalendarId('');
        toast({ title: 'Google Calendar desconectado' });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'No se pudo desconectar Google Calendar.',
        });
      } finally {
        setIsGoogleDisconnecting(false);
      }
    };

    const handleDayChange = (
      dayKey: WeekdayKey,
      field: 'enabled' | 'start' | 'end' | 'breakStart' | 'breakEnd',
      value: string | boolean
    ) => {
      setWorkingDays((prev) => {
        const current = prev[dayKey];
        const currentBreak = current.breaks[0] || { start: '13:00', end: '14:00' };

        const next: WorkingDayConfig = {
          ...current,
          breaks: [...current.breaks],
        };

        if (field === 'enabled' && typeof value === 'boolean') {
          next.enabled = value;
        } else if (field === 'start' && typeof value === 'string') {
          next.start = value;
        } else if (field === 'end' && typeof value === 'string') {
          next.end = value;
        } else if (field === 'breakStart' && typeof value === 'string') {
          next.breaks = [{ ...currentBreak, start: value }];
        } else if (field === 'breakEnd' && typeof value === 'string') {
          next.breaks = [{ ...currentBreak, end: value }];
        }

        return {
          ...prev,
          [dayKey]: next,
        };
      });
    };

    const handleSaveSchedule = async () => {
      if (!professionalId) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se encontró el profesional para guardar horarios.',
        });
        return;
      }

      try {
        setIsSavingSchedule(true);

        const duration = Number(appointmentDuration) || 30;
        const workingHours = JSON.stringify({
          appointmentDuration: duration,
          days: workingDays,
        });

        const response = await fetchWithAuth('/api/dashboard/professional', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professionalId,
            appointmentDuration: duration,
            workingHours,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'No se pudieron guardar los horarios.');
        }

        toast({
          title: 'Horarios guardados',
          description: 'Tu configuración se guardó correctamente.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudieron guardar los horarios.',
        });
      } finally {
        setIsSavingSchedule(false);
      }
    };

    const formatDateToKey = React.useCallback((date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }, []);

    const normalizeSelectedBlockedDates = React.useCallback((selected: Date[] | undefined) => {
      const unique = new Set<string>();
      for (const date of selected || []) {
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          unique.add(formatDateToKey(date));
        }
      }
      return Array.from(unique).sort();
    }, [formatDateToKey]);

    const blockedDateKeysSorted = React.useMemo(
      () => normalizeSelectedBlockedDates(selectedBlockedDates),
      [normalizeSelectedBlockedDates, selectedBlockedDates],
    );

    const blockedDateKeysSet = React.useMemo(
      () => new Set(blockedDateKeysSorted),
      [blockedDateKeysSorted],
    );

    /** Solo bloquea fechas pasadas que no están ya en la lista: así los días guardados siguen visibles y se pueden quitar. */
    const isCalendarDayDisabled = React.useCallback(
      (date: Date) => {
        const key = formatDateToKey(date);
        const today = startOfDay(new Date());
        if (startOfDay(date) < today && !blockedDateKeysSet.has(key)) return true;
        return false;
      },
      [blockedDateKeysSet, formatDateToKey],
    );

    const hasBlockedDatesChanges = React.useMemo(() => {
      const selected = normalizeSelectedBlockedDates(selectedBlockedDates);
      if (selected.length !== blockedDates.length) return true;
      return selected.some((date, index) => date !== blockedDates[index]);
    }, [blockedDates, normalizeSelectedBlockedDates, selectedBlockedDates]);

    const handleRemoveBlockedDate = (date: string) => {
      setSelectedBlockedDates((prev) =>
        prev.filter((d) => formatDateToKey(d) !== date)
      );
    };

    const handleSaveBlockedDates = async () => {
      if (!professionalId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el profesional.' });
        return;
      }

      const nextBlockedDates = normalizeSelectedBlockedDates(selectedBlockedDates);

      try {
        setIsSavingBlockedDates(true);
        const response = await fetchWithAuth('/api/dashboard/professional', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ professionalId, blockedDates: nextBlockedDates }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'No se pudo guardar.');
        }
        setBlockedDates(nextBlockedDates);
        setConfirmBlockedDatesOpen(false);
        toast({ title: 'Días guardados', description: 'Los días no laborables se actualizaron.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar.' });
      } finally {
        setIsSavingBlockedDates(false);
      }
    };

    const handleSaveCardTheme = async () => {
      if (!professionalId) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se encontró el profesional para guardar personalización.',
        });
        return;
      }

      try {
        setIsSavingTheme(true);
        const response = await fetchWithAuth('/api/dashboard/professional', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professionalId,
            publicProfile: {
              cardTheme,
            },
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'No se pudo guardar la personalización.');
        }

        toast({
          title: 'Personalización guardada',
          description: 'Los colores de tu card pública se actualizaron correctamente.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo guardar la personalización.',
        });
      } finally {
        setIsSavingTheme(false);
      }
    };

    const handleStartMfaSetup = async () => {
      if (!auth.currentUser) return;

      try {
        setIsStartingMfaSetup(true);
        const idToken = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/auth/mfa/setup', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('No se pudo iniciar setup MFA.');
        }

        const data = (await response.json()) as { otpauthUrl: string };
        setMfaSetupUrl(data.otpauthUrl);
        setBackupCodes([]);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error MFA',
          description: 'No se pudo iniciar la configuración MFA.',
        });
      } finally {
        setIsStartingMfaSetup(false);
      }
    };

    const handleConfirmMfa = async () => {
      if (!auth.currentUser || !mfaCode.trim()) return;

      try {
        setIsConfirmingMfa(true);
        const idToken = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/auth/mfa/enable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ code: mfaCode.trim() }),
        });

        if (!response.ok) {
          throw new Error('Código MFA inválido.');
        }

        const data = (await response.json()) as { backupCodes: string[] };
        setMfaEnabled(true);
        setBackupCodes(data.backupCodes || []);
        setMfaCode('');

        toast({
          title: 'MFA activado',
          description: 'Guarda tus backup codes en un lugar seguro.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error MFA',
          description: 'No se pudo confirmar el segundo factor.',
        });
      } finally {
        setIsConfirmingMfa(false);
      }
    };

    const embedCode = `<script 
  src="${origin}/widget.js" 
  data-professional-id="DR-JUAN-PEREZ" 
  data-main-color="${widgetColor}" 
  defer>
</script>`;
  
    const settingsTabTriggerClass =
      'rounded-xl px-2 py-2.5 text-[12px] font-medium leading-tight sm:px-3 sm:py-2 sm:text-sm';

    return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="space-y-1 px-0.5">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground sm:text-3xl">Configuración</h1>
        <p className="text-[15px] text-muted-foreground">Preferencias, horarios e integraciones.</p>
      </header>
      <Tabs defaultValue="horarios" className="w-full">
        <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 gap-1 rounded-2xl border border-border/50 bg-muted/35 p-1.5 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="horarios" className={settingsTabTriggerClass}>
            Horarios
          </TabsTrigger>
          <TabsTrigger value="dias-libres" className={settingsTabTriggerClass}>
            Días libres
          </TabsTrigger>
          <TabsTrigger value="personalizacion" className={settingsTabTriggerClass}>
            Personalización
          </TabsTrigger>
          <TabsTrigger value="preferencias" className={settingsTabTriggerClass}>
            Preferencias
          </TabsTrigger>
          <TabsTrigger value="mensajeria" className={settingsTabTriggerClass}>
            Mensajería
          </TabsTrigger>
          <TabsTrigger value="integraciones" className={settingsTabTriggerClass}>
            Integraciones
          </TabsTrigger>
          <TabsTrigger value="widget" className={settingsTabTriggerClass}>
            Widget Web
          </TabsTrigger>
          <TabsTrigger value="seguridad" className={settingsTabTriggerClass}>
            Seguridad
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="horarios" className="mt-6 outline-none focus-visible:outline-none sm:mt-8">
          <div className="mx-auto max-w-2xl space-y-8 pb-8">
            <header className="space-y-1.5 px-0.5">
              <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
                Horarios de atención
              </h2>
              <p className="max-w-md text-[15px] leading-snug text-muted-foreground">
                Activá los días que atendés y ajustá horario y descanso para cada uno.
              </p>
            </header>

            <section className="space-y-2">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Consulta
              </p>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5">
                  <Label htmlFor="duracion" className="text-[15px] font-normal leading-tight text-foreground">
                    Duración por defecto
                  </Label>
                  <Select value={appointmentDuration} onValueChange={setAppointmentDuration}>
                    <SelectTrigger
                      id="duracion"
                      className="h-11 w-full rounded-xl border-0 bg-muted/50 shadow-none ring-offset-0 focus:ring-2 focus:ring-primary/25 sm:w-[200px]"
                    >
                      <SelectValue placeholder="Elegir" />
                    </SelectTrigger>
                    <SelectContent align="end" className="rounded-xl">
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {!isLoadingSchedule && WEEKDAY_KEYS.some((k) => !workingDays[k].enabled) ? (
              <section className="space-y-2">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Días apagados
                </p>
                <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3.5 shadow-sm">
                  <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                    Podés volver a activarlos cuando quieras.
                  </p>
                  <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {WEEKDAY_KEYS.filter((k) => !workingDays[k].enabled).map((dayKey) => (
                      <li
                        key={dayKey}
                        className="flex items-center justify-between gap-3 rounded-xl bg-card/80 px-3 py-2.5 ring-1 ring-border/50 sm:inline-flex sm:max-w-none"
                      >
                        <span className="text-[15px] font-medium">{DAY_LABELS[dayKey]}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold text-primary hover:bg-primary/10"
                          onClick={() => handleDayChange(dayKey, 'enabled', true)}
                        >
                          Activar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Semana
              </p>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                {isLoadingSchedule ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {WEEKDAY_KEYS.map((dayKey) => {
                      const day = workingDays[dayKey];
                      const breakSlot = day.breaks[0] || { start: '13:00', end: '14:00' };
                      const disabled = !day.enabled;
                      return (
                        <li key={dayKey} className="bg-card">
                          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3.5">
                            <Label
                              htmlFor={`day-${dayKey}`}
                              className="cursor-pointer text-[17px] font-medium leading-none text-foreground"
                            >
                              {DAY_LABELS[dayKey]}
                            </Label>
                            <Switch
                              id={`day-${dayKey}`}
                              checked={day.enabled}
                              onCheckedChange={(checked) => handleDayChange(dayKey, 'enabled', checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          {day.enabled ? (
                            <div className="space-y-4 border-t border-border/40 bg-muted/15 px-4 py-4 sm:bg-muted/10">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Horario
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="time"
                                      value={day.start}
                                      disabled={disabled}
                                      onChange={(e) => handleDayChange(dayKey, 'start', e.target.value)}
                                      className="h-11 flex-1 rounded-xl border-0 bg-background/80 shadow-sm ring-1 ring-border/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                                    />
                                    <span className="shrink-0 text-muted-foreground">–</span>
                                    <Input
                                      type="time"
                                      value={day.end}
                                      disabled={disabled}
                                      onChange={(e) => handleDayChange(dayKey, 'end', e.target.value)}
                                      className="h-11 flex-1 rounded-xl border-0 bg-background/80 shadow-sm ring-1 ring-border/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Descanso
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="time"
                                      value={breakSlot.start}
                                      disabled={disabled}
                                      onChange={(e) => handleDayChange(dayKey, 'breakStart', e.target.value)}
                                      className="h-11 flex-1 rounded-xl border-0 bg-background/80 shadow-sm ring-1 ring-border/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                                    />
                                    <span className="shrink-0 text-muted-foreground">–</span>
                                    <Input
                                      type="time"
                                      value={breakSlot.end}
                                      disabled={disabled}
                                      onChange={(e) => handleDayChange(dayKey, 'breakEnd', e.target.value)}
                                      className="h-11 flex-1 rounded-xl border-0 bg-background/80 shadow-sm ring-1 ring-border/40 focus-visible:ring-2 focus-visible:ring-primary/30"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <div className="sticky bottom-3 z-10 px-0 pt-2 sm:static sm:pt-0">
              <Button
                type="button"
                onClick={handleSaveSchedule}
                disabled={isLoadingSchedule || isSavingSchedule}
                className="h-12 w-full rounded-2xl text-[15px] font-semibold shadow-sm sm:h-11 sm:max-w-xs"
              >
                {isSavingSchedule ? 'Guardando…' : 'Guardar horarios'}
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="dias-libres" className="mt-6 outline-none focus-visible:outline-none sm:mt-8">
          <div className="mx-auto max-w-5xl space-y-8 pb-8">
            <header className="flex flex-col gap-3 px-0.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                    <CalendarX className="h-4 w-4" />
                  </div>
                  <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
                    Días no laborables
                  </h2>
                </div>
                <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  Marcá fechas puntuales (feriados, vacaciones). Siguen en la lista aunque ya pasaron; quitá con el botón y guardá para reactivar turnos.
                </p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
              <section className="space-y-2 lg:col-span-5 xl:col-span-4">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Calendario
                </p>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
                  <Calendar
                    mode="multiple"
                    selected={selectedBlockedDates}
                    onSelect={(dates) => setSelectedBlockedDates(dates || [])}
                    disabled={isCalendarDayDisabled}
                    className="mx-auto w-full max-w-[320px]"
                  />
                </div>
              </section>

              <section className="min-w-0 space-y-2 lg:col-span-7 xl:col-span-8">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Bloqueados
                  {blockedDateKeysSorted.length > 0 ? (
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/80">
                      ({blockedDateKeysSorted.length})
                    </span>
                  ) : null}
                </p>

                {blockedDateKeysSorted.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center sm:min-h-[240px]">
                    <CalendarX className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="max-w-xs text-[15px] leading-snug text-muted-foreground">
                      Ningún día bloqueado. Elegí fechas a la izquierda y tocá <span className="font-medium text-foreground">Guardar</span>.
                    </p>
                  </div>
                ) : (
                  <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm divide-y divide-border/50">
                    {blockedDateKeysSorted.map((date) => {
                      const d = new Date(`${date}T12:00:00`);
                      const label = d.toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });
                      return (
                        <li key={date} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3">
                          <span className="min-w-0 flex-1 text-[15px] capitalize leading-snug text-foreground">
                            {label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlockedDate(date)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
                            aria-label={`Quitar ${label}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="pt-2">
                  <AlertDialog open={confirmBlockedDatesOpen} onOpenChange={setConfirmBlockedDatesOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={isLoadingSchedule || isSavingBlockedDates || !hasBlockedDatesChanges}
                        className="h-12 w-full rounded-2xl text-[15px] font-semibold shadow-sm sm:h-11 sm:max-w-xs"
                      >
                        {isSavingBlockedDates ? 'Guardando…' : 'Guardar días'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-semibold">
                          ¿Guardar días no laborables?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[15px] leading-relaxed">
                          Se guardarán{' '}
                          <span className="font-medium text-foreground">
                            {normalizeSelectedBlockedDates(selectedBlockedDates).length}
                          </span>{' '}
                          día
                          {normalizeSelectedBlockedDates(selectedBlockedDates).length !== 1 ? 's' : ''} bloqueado
                          {normalizeSelectedBlockedDates(selectedBlockedDates).length !== 1 ? 's' : ''}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                        <AlertDialogCancel className="mt-0 h-11 rounded-xl border-0 bg-muted/60 sm:mr-auto">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="h-11 rounded-xl font-semibold"
                          onClick={() => void handleSaveBlockedDates()}
                        >
                          Guardar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="personalizacion">
          <Card>
            <CardHeader>
              <CardTitle>Personalización de la Card Pública</CardTitle>
              <CardDescription>
                Aquí solo podés ajustar colores de la card del perfil público. El nombre y las fotos se editan desde Perfil Público.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="color-primary">Color principal</Label>
                  <Input
                    id="color-primary"
                    type="color"
                    value={cardTheme.primaryColor}
                    onChange={(event) =>
                      setCardTheme((current) => ({ ...current, primaryColor: event.target.value }))
                    }
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color-background">Color de fondo</Label>
                  <Input
                    id="color-background"
                    type="color"
                    value={cardTheme.backgroundColor}
                    onChange={(event) =>
                      setCardTheme((current) => ({ ...current, backgroundColor: event.target.value }))
                    }
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color-accent">Color de acento</Label>
                  <Input
                    id="color-accent"
                    type="color"
                    value={cardTheme.accentColor}
                    onChange={(event) =>
                      setCardTheme((current) => ({ ...current, accentColor: event.target.value }))
                    }
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ backgroundColor: cardTheme.backgroundColor }}>
                <p className="font-semibold" style={{ color: cardTheme.accentColor }}>
                  Vista previa rápida
                </p>
                <p className="text-sm" style={{ color: cardTheme.accentColor }}>
                  Este estilo se aplicará en la card izquierda del perfil público.
                </p>
                <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: cardTheme.primaryColor, color: '#ffffff' }}>
                  Color principal
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveCardTheme} disabled={isSavingTheme}>
                {isSavingTheme ? 'Guardando...' : 'Guardar Personalización'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="preferencias">
            <Card>
                <CardHeader>
                    <CardTitle>Preferencias Generales</CardTitle>
                    <CardDescription>Configura el comportamiento general de la plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Enviar recordatorios</Label>
                         <Select defaultValue="24">
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Seleccionar cuándo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="12">12 horas antes</SelectItem>
                                <SelectItem value="24">24 horas antes</SelectItem>
                                <SelectItem value="48">48 horas antes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="require-confirmation" defaultChecked />
                        <Label htmlFor="require-confirmation">Requerir confirmación de asistencia</Label>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button>Guardar Preferencias</Button>
                </CardFooter>
            </Card>
        </TabsContent>

        <TabsContent value="mensajeria">
          <Card>
            <CardHeader>
              <CardTitle>Plantillas de WhatsApp</CardTitle>
              <CardDescription>
                Personaliza los mensajes automáticos que envía el chatbot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="msg-welcome">Mensaje de Bienvenida</Label>
                    <Textarea id="msg-welcome" placeholder="El bot saludará con este mensaje." defaultValue="¡Hola! Soy el asistente virtual de [Nombre del Profesional]. ¿Cómo puedo ayudarte hoy? Puedes escribir 'TURNO' para agendar o 'AYUDA' para ver más opciones." />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="msg-confirmation">Mensaje de Confirmación de Turno</Label>
                    <Textarea id="msg-confirmation" placeholder="Mensaje que se envía al confirmar un turno." defaultValue="¡Perfecto, [Nombre del Paciente]! Tu turno ha sido agendado para el [Fecha] a las [Hora]. Recibirás un recordatorio 24hs antes. ¡Saludos!" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="msg-reminder">Mensaje de Recordatorio</Label>
                    <Textarea id="msg-reminder" placeholder="Recordatorio enviado 24hs antes." defaultValue="¡Hola, [Nombre del Paciente]! Te recuerdo tu turno con [Nombre del Profesional] mañana a las [Hora]. Por favor, responde 'CONFIRMO' para asegurar tu lugar o 'CANCELAR' si no puedes asistir." />
                </div>
            </CardContent>
             <CardFooter>
              <Button>Guardar Plantillas</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="integraciones">
          <Card>
            <CardHeader>
              <CardTitle>Integraciones</CardTitle>
              <CardDescription>
                Conecta MediTurnos con otras herramientas que ya usas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg">Calendario de Google</CardTitle>
                            <CardDescription>
                              Sincronizá automáticamente los turnos confirmados, cancelaciones y cambios con tu Google Calendar.
                              {isGoogleConnected && googleEmail ? ` Conectado como ${googleEmail}.` : ''}
                            </CardDescription>
                            {isGoogleConnected && googleCalendarId && (
                              <p className="text-xs text-muted-foreground">Calendario: {googleCalendarId}</p>
                            )}
                        </div>
                        {isGoogleConnected ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleDisconnectGoogle()}
                            disabled={isGoogleDisconnecting || isGoogleStatusLoading}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            {isGoogleDisconnecting ? 'Desconectando...' : 'Conectado'}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            onClick={() => void handleConnectGoogle()}
                            disabled={isGoogleConnecting || isGoogleStatusLoading || !isGoogleAvailable}
                          >
                            {isGoogleConnecting ? 'Conectando...' : 'Conectar'}
                          </Button>
                        )}
                    </CardHeader>
                    {!isGoogleAvailable && (
                      <CardContent>
                        <p className="text-sm text-amber-700">
                          La integración está deshabilitada porque faltan variables del servidor. Configurá Google OAuth para habilitar el botón Conectar.
                        </p>
                      </CardContent>
                    )}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Guía rápida de sincronización</CardTitle>
                        <CardDescription>
                          Seguí estos pasos una sola vez para conectar el calendario del profesional.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="rounded-lg border p-3">
                          <p className="font-medium mb-1">1) Crear credenciales en Google Cloud</p>
                          <p className="text-muted-foreground">
                            Ingresá a Google Cloud Console, creá un proyecto, activá Google Calendar API y configurá OAuth Consent Screen.
                            Luego creá un OAuth Client ID de tipo Web application.
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="font-medium mb-1">2) Variables necesarias en el servidor</p>
                          <p className="text-muted-foreground">
                            GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL, GOOGLE_REDIRECT_URI y GOOGLE_OAUTH_STATE_SECRET.
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="font-medium mb-1">3) Redirect URI autorizada</p>
                          <p className="text-muted-foreground">
                            En Google OAuth agregá esta URL exacta como Authorized redirect URI:
                          </p>
                          <p className="mt-2 rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
                            {(process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000') + '/api/integrations/google/callback'}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="font-medium mb-1">4) Conectar</p>
                          <p className="text-muted-foreground">
                            Volvé a esta sección y presioná Conectar para autorizar con tu cuenta Google del profesional.
                          </p>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                            <CardDescription>Envía recordatorios y notificaciones a tus pacientes.</CardDescription>
                        </div>
                        <Button variant={isWhatsAppConnected ? "secondary" : "default"} onClick={() => setIsWhatsAppConnected(!isWhatsAppConnected)}>
                          {isWhatsAppConnected ? <><CheckCircle className="mr-2 h-4 w-4" /> Conectado</> : 'Conectar'}
                        </Button>
                    </CardHeader>
                </Card>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="widget">
          <Card>
            <CardHeader>
              <CardTitle>Widget para tu Sitio Web</CardTitle>
              <CardDescription>
                Copia y pega este código en tu sitio web para permitir que los pacientes agenden turnos directamente desde allí.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-4">
                    <h4 className="font-medium">Vista Previa del Botón</h4>
                    <div className="p-8 rounded-lg border bg-muted flex items-center justify-center">
                         <Button size="lg" style={{ backgroundColor: widgetColor }}>Agendar un Turno</Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="widget-color">Color Principal</Label>
                    <div className="flex items-center gap-2">
                        <Input id="widget-color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="w-32" />
                        <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: widgetColor }}></div>
                    </div>
                     <p className="text-sm text-muted-foreground">Elige el color de acento para el botón del widget.</p>
                </div>
                <div className="space-y-2">
                    <Label>Código de Inserción</Label>
                    <div className="bg-gray-900 rounded-md p-4 text-sm text-gray-200 font-mono overflow-x-auto min-h-[120px]">
                        {isClient ? (
                            <pre><code>{embedCode}</code></pre>
                        ) : (
                            <Skeleton className="h-20 w-full bg-gray-700" />
                        )}
                    </div>
                     <p className="text-sm text-muted-foreground">Pega este código justo antes de la etiqueta &lt;/body&gt; en tu sitio web.</p>
                </div>
            </CardContent>
            <CardFooter>
              <Button>Guardar Cambios</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="seguridad">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad de la Cuenta</CardTitle>
              <CardDescription>
                Activa autenticación de dos factores (TOTP) para proteger tu cuenta además del SMS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingMfaStatus ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="rounded-md border p-4">
                  <p className="font-medium">Estado MFA: {mfaEnabled ? 'Activado' : 'Desactivado'}</p>
                  <p className="text-sm text-muted-foreground">
                    Usa una app autenticadora (Google Authenticator, Authy, Microsoft Authenticator).
                  </p>
                </div>
              )}

              {!mfaEnabled && (
                <div className="space-y-4">
                  <Button onClick={handleStartMfaSetup} disabled={isStartingMfaSetup}>
                    {isStartingMfaSetup ? 'Preparando QR...' : 'Iniciar configuración MFA'}
                  </Button>

                  {mfaSetupUrl && (
                    <div className="space-y-4">
                      <div className="w-fit rounded-md border p-4 bg-white">
                        <QRCode value={mfaSetupUrl} size={180} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                        <Input
                          id="mfa-code"
                          placeholder="123456"
                          value={mfaCode}
                          onChange={(event) => setMfaCode(event.target.value)}
                        />
                      </div>
                      <Button onClick={handleConfirmMfa} disabled={isConfirmingMfa || mfaCode.trim().length < 6}>
                        {isConfirmingMfa ? 'Confirmando...' : 'Confirmar y activar MFA'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {backupCodes.length > 0 && (
                <div className="space-y-2 rounded-md border p-4">
                  <p className="font-medium">Backup codes (guárdalos ahora)</p>
                  <p className="text-xs text-muted-foreground">Cada código se puede usar una sola vez.</p>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    {backupCodes.map((code) => (
                      <div key={code} className="rounded bg-muted px-2 py-1">{code}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
