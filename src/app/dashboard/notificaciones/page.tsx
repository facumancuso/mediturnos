'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Calendar, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { cn } from '@/lib/utils';

type DashboardNotification = {
  id: string;
  sourceKey: string;
  type: 'pending_appointment' | 'reminder' | 'patient_confirmed' | 'patient_declined';
  patientName: string;
  date: string;
  time: string;
  title: string;
  description: string;
  href: string;
  isRead: boolean;
  isActive: boolean;
  createdAt: string;
  readAt?: string | null;
  resolvedAt?: string | null;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationIcon({ type }: { type: DashboardNotification['type'] }) {
  if (type === 'pending_appointment') return <Calendar className="h-4 w-4 text-amber-600" />;
  if (type === 'patient_confirmed') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (type === 'patient_declined') return <XCircle className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-blue-600" />;
}

export default function NotificacionesPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  async function loadNotifications() {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/notifications?scope=all', { cache: 'no-store' });
      const payload = response.ok ? await response.json() : null;
      setNotifications(payload?.notifications || []);
      setUnreadCount(payload?.unreadCount || 0);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead && notification.isActive),
    [notifications]
  );

  async function markAsRead(notificationId: string) {
    setIsUpdating(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        await loadNotifications();
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function markAllAsRead() {
    setIsUpdating(true);
    try {
      const response = await fetchWithAuth('/api/dashboard/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (response.ok) {
        await loadNotifications();
      }
    } finally {
      setIsUpdating(false);
    }
  }

  async function openNotification(notification: DashboardNotification) {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    router.push(notification.href);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todas las alertas del consultorio, tanto pendientes como ya revisadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadNotifications()} disabled={isLoading || isUpdating} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', (isLoading || isUpdating) && 'animate-spin')} />
            Actualizar
          </Button>
          <Button onClick={() => void markAllAsRead()} disabled={unreadCount === 0 || isUpdating} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Marcar todo como leído
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">No leídas</p>
            <p className="mt-2 text-3xl font-bold">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Activas</p>
            <p className="mt-2 text-3xl font-bold">{notifications.filter((item) => item.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Historial</p>
            <p className="mt-2 text-3xl font-bold">{notifications.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>Centro de notificaciones</CardTitle>
          <CardDescription>
            Cuando abrís una notificación deja de figurar como nueva, pero sigue disponible en el historial.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0">
          <Tabs defaultValue="pendientes" className="flex h-full min-h-[480px] flex-col">
            <TabsList className="mb-4 w-full sm:w-auto">
              <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="pendientes" className="mt-0 flex-1 min-h-0">
              <ScrollArea className="h-[460px] pr-4">
                <NotificationList
                  notifications={unreadNotifications}
                  isLoading={isLoading}
                  emptyTitle="No hay notificaciones pendientes"
                  emptyDescription="Las nuevas alertas van a aparecer acá."
                  onMarkAsRead={(id) => void markAsRead(id)}
                  onOpen={(notification) => void openNotification(notification)}
                  isUpdating={isUpdating}
                />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="historial" className="mt-0 flex-1 min-h-0">
              <ScrollArea className="h-[460px] pr-4">
                <NotificationList
                  notifications={notifications}
                  isLoading={isLoading}
                  emptyTitle="Todavía no hay historial"
                  emptyDescription="Acá vas a ver las notificaciones revisadas y resueltas."
                  onMarkAsRead={(id) => void markAsRead(id)}
                  onOpen={(notification) => void openNotification(notification)}
                  isUpdating={isUpdating}
                  showHistory
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationList({
  notifications,
  isLoading,
  emptyTitle,
  emptyDescription,
  onMarkAsRead,
  onOpen,
  isUpdating,
  showHistory = false,
}: {
  notifications: DashboardNotification[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onMarkAsRead: (id: string) => void;
  onOpen: (notification: DashboardNotification) => void;
  isUpdating: boolean;
  showHistory?: boolean;
}) {
  if (isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">Cargando notificaciones...</div>;
  }

  if (notifications.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed text-center">
        <Bell className="mb-4 h-10 w-10 text-muted-foreground/70" />
        <p className="font-medium">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div key={notification.id} className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              notification.type === 'pending_appointment'
                ? 'bg-amber-100 dark:bg-amber-900/20'
                : notification.type === 'patient_confirmed'
                  ? 'bg-emerald-100 dark:bg-emerald-900/20'
                  : notification.type === 'patient_declined'
                    ? 'bg-red-100 dark:bg-red-900/20'
                    : 'bg-blue-100 dark:bg-blue-900/20'
            )}>
              <NotificationIcon type={notification.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{notification.title}</p>
                {!notification.isRead && <Badge variant="secondary">Nueva</Badge>}
                {!notification.isActive && showHistory && <Badge variant="outline">Resuelta</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDateTime(notification.createdAt)}</span>
                <span>{notification.patientName}</span>
                <span>{notification.time} hs</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpen(notification)}>
              Abrir
            </Button>
            {!notification.isRead && (
              <Button size="sm" onClick={() => onMarkAsRead(notification.id)} disabled={isUpdating}>
                Marcar como leída
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}