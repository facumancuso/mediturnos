'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import QRCode from "react-qr-code";
import { useAuth } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
    const [isWhatsAppConnected, setIsWhatsAppConnected] = React.useState(false);
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
    const auth = useAuth();
    const { toast } = useToast();

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
  
    return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajusta tus preferencias, horarios e integraciones.
        </p>
      </div>
      <Tabs defaultValue="horarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="personalizacion">Personalización</TabsTrigger>
          <TabsTrigger value="preferencias">Preferencias</TabsTrigger>
          <TabsTrigger value="mensajeria">Mensajería</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          <TabsTrigger value="widget">Widget Web</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>
        
        <TabsContent value="horarios">
          <Card>
            <CardHeader>
              <CardTitle>Horarios de Atención</CardTitle>
              <CardDescription>
                Define cuándo estás disponible para recibir pacientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="duracion">Duración de consulta por defecto</Label>
                    <Select defaultValue="30">
                        <SelectTrigger id="duracion" className="w-[180px]">
                            <SelectValue placeholder="Seleccionar duración" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="15">15 minutos</SelectItem>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="45">45 minutos</SelectItem>
                            <SelectItem value="60">60 minutos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-4">
                    {daysOfWeek.map(day => (
                        <div key={day} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 rounded-lg border">
                            <div className="flex items-center gap-2 col-span-1">
                                <Checkbox id={`check-${day}`} defaultChecked={day !== "Sábado" && day !== "Domingo"} />
                                <Label htmlFor={`check-${day}`} className="font-medium">{day}</Label>
                            </div>
                            <div className="flex items-center gap-2 col-span-4 md:col-span-2">
                                <Input type="time" defaultValue="09:00" />
                                <span>-</span>
                                <Input type="time" defaultValue="18:00" />
                            </div>
                            <div className="flex items-center gap-2 col-span-4 md:col-span-2">
                                <Label>Descanso:</Label>
                                <Input type="time" defaultValue="13:00" />
                                <span>-</span>
                                <Input type="time" defaultValue="14:00" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter>
              <Button>Guardar Cambios</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="personalizacion">
          <Card>
            <CardHeader>
              <CardTitle>Personalización de Marca</CardTitle>
              <CardDescription>
                Adapta la apariencia de la plataforma y las comunicaciones a la identidad de tu consultorio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-2">
                    <Label htmlFor="brand-name">Nombre a mostrar (Clínica o Profesional)</Label>
                    <Input id="brand-name" defaultValue="Dr. Juan Pérez" />
                    <p className="text-xs text-muted-foreground">Este nombre aparecerá en las comunicaciones y el widget.</p>
                </div>
                <div className="space-y-4">
                    <h3 className="font-medium">Logo del Consultorio</h3>
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src="https://picsum.photos/seed/logo-clinic/100/100" alt="Logo" data-ai-hint="logo placeholder" />
                            <AvatarFallback>JP</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <Input id="logo-upload" type="file" className="max-w-sm" />
                            <p className="text-xs text-muted-foreground">Sube tu logo. Recomendado: 200x200px, PNG o JPG.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                    <h3 className="font-medium">Colores del Tema</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="color-primary">Color Principal</Label>
                            <Input id="color-primary" type="color" defaultValue="#0d6efd" className="h-10 w-14 cursor-pointer p-1" />
                            <p className="text-xs text-muted-foreground">Usado en botones y elementos principales.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="color-background">Color de Fondo</Label>
                            <Input id="color-background" type="color" defaultValue="#f8f9fa" className="h-10 w-14 cursor-pointer p-1" />
                            <p className="text-xs text-muted-foreground">El color de fondo general de la app.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="color-accent">Color de Acento</Label>
                            <Input id="color-accent" type="color" defaultValue="#6c757d" className="h-10 w-14 cursor-pointer p-1" />
                            <p className="text-xs text-muted-foreground">Para enlaces y elementos secundarios.</p>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
              <Button>Guardar Personalización</Button>
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
                            <CardTitle className="text-lg">Google Calendar</CardTitle>
                            <CardDescription>Sincroniza tus turnos con tu calendario de Google.</CardDescription>
                        </div>
                        <Button variant={isGoogleConnected ? "secondary" : "default"} onClick={() => setIsGoogleConnected(!isGoogleConnected)}>
                          {isGoogleConnected ? <><CheckCircle className="mr-2 h-4 w-4" /> Conectado</> : 'Conectar'}
                        </Button>
                    </CardHeader>
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
