'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Contact,
  DollarSign,
  Home,
  LineChart,
  Menu,
  Settings,
  User,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { useFirestore, useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DashboardNotification = {
  id: string;
  type: 'pending_appointment' | 'reminder' | 'patient_confirmed' | 'patient_declined';
  title: string;
  description: string;
  href: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [accessChecked, setAccessChecked] = useState(false);
  const [googleGateChecked, setGoogleGateChecked] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    let cancelled = false;

    async function validateDashboardAccess() {
      try {
        const superAdminDoc = await getDoc(doc(firestore, 'roles_super_admin', user.uid));
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        const userRole = String(userDoc.data()?.role || '').toLowerCase();
        const isSuperAdminUserDoc =
          userDoc.exists() && (userRole === 'super_admin' || userRole === 'super-admin');

        if (superAdminDoc.exists() || isSuperAdminUserDoc) {
          router.replace('/super-dashboard');
          return;
        }
      } catch (error) {
        console.error('No se pudo validar rol super-admin en dashboard:', error);
      }

      if (!cancelled) {
        setAccessChecked(true);
      }
    }

    validateDashboardAccess();

    return () => {
      cancelled = true;
    };
  }, [isUserLoading, user, router, firestore]);

  useEffect(() => {
    if (!accessChecked || !user?.uid) return;

    let cancelled = false;
    const googleGateCacheKey = `google-calendar-gate:${user.uid}`;
    const GOOGLE_GATE_TTL_MS = 5 * 60_000;

    async function enforceGoogleCalendarConnection() {
      // Allow access to settings so the user can complete the required connection flow.
      if (pathname.startsWith('/dashboard/configuracion')) {
        if (!cancelled) {
          setGoogleGateChecked(true);
        }
        return;
      }

      try {
        const rawCached = sessionStorage.getItem(googleGateCacheKey);
        if (rawCached) {
          const cached = JSON.parse(rawCached) as { checkedAt?: number; connected?: boolean; available?: boolean };
          const checkedAt = Number(cached?.checkedAt || 0);
          if (Date.now() - checkedAt < GOOGLE_GATE_TTL_MS) {
            if (cached.available === false || cached.connected) {
              if (!cancelled) {
                setGoogleGateChecked(true);
              }
              return;
            }
          }
        }
      } catch {
        // Ignorar cache inválido y continuar con request normal.
      }

      try {
        const response = await fetchWithAuth('/api/dashboard/integrations/google/status');

        if (!response.ok) {
          throw new Error('No se pudo validar estado de Google Calendar.');
        }

        const data = (await response.json()) as { connected?: boolean; available?: boolean };

        try {
          sessionStorage.setItem(
            googleGateCacheKey,
            JSON.stringify({
              checkedAt: Date.now(),
              connected: Boolean(data.connected),
              available: data.available !== false,
            })
          );
        } catch {
          // Storage puede no estar disponible, no bloquea flujo.
        }

        // If OAuth is not configured on the server yet, do not hard-block dashboard usage.
        if (data.available === false) {
          if (!cancelled) {
            setGoogleGateChecked(true);
          }
          return;
        }

        if (!data.connected) {
          router.replace('/dashboard/configuracion?googleRequired=1');
          return;
        }
      } catch (error) {
        console.error('No se pudo aplicar validación de Google Calendar obligatorio:', error);
      }

      if (!cancelled) {
        setGoogleGateChecked(true);
      }
    }

    enforceGoogleCalendarConnection();

    return () => {
      cancelled = true;
    };
  }, [accessChecked, pathname, router, user?.uid]);

  // Auto-sync: asegura que el profesional existe en MongoDB al entrar al dashboard
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;

    async function syncProfessionalIfNeeded() {
      try {
        const superAdminDoc = await getDoc(doc(firestore, 'roles_super_admin', uid));
        const userDoc = await getDoc(doc(firestore, 'users', uid));
        const userRole = String(userDoc.data()?.role || '').toLowerCase();
        const isSuperAdminUserDoc =
          userDoc.exists() && (userRole === 'super_admin' || userRole === 'super-admin');

        if (superAdminDoc.exists() || isSuperAdminUserDoc) {
          return;
        }
      } catch (roleCheckError) {
        console.error('No se pudo validar rol super-admin antes de autosync:', roleCheckError);
      }

      fetchWithAuth(`/api/dashboard/professional?professionalId=${uid}`)
        .then((res) => {
          if (res.status === 404) {
            return fetchWithAuth('/api/dashboard/professional', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: uid,
                userId: uid,
                name: user.displayName || 'Profesional',
                email: user.email || '',
              }),
            });
          }
        })
        .catch((err) => console.error('Auto-sync profesional MongoDB:', err));
    }

    syncProfessionalIfNeeded();
  }, [user?.uid, user?.displayName, user?.email, firestore]);

  useEffect(() => {
    if (!user?.uid) return;

    function fetchNotifications() {
      fetchWithAuth('/api/dashboard/notifications')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
          }
        })
        .catch(() => {});
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  if (isUserLoading || !user || !accessChecked || !googleGateChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground animate-fade-in">
        Verificando acceso...
      </div>
    );
  }

  // Nav groups — logical sections matching macOS sidebar convention
  const navGroups = [
    {
      items: [
        { href: '/dashboard', label: 'Hoy', icon: Home },
        { href: '/dashboard/calendario', label: 'Calendario', icon: Calendar },
        { href: '/dashboard/pacientes', label: 'Pacientes', icon: Users },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { href: '/dashboard/tareas', label: 'Tareas', icon: ClipboardList },
        { href: '/dashboard/recordatorios', label: 'Recordatorios', icon: Bell },
        { href: '/dashboard/reportes', label: 'Reportes', icon: LineChart },
        { href: '/dashboard/equipo', label: 'Equipo', icon: Contact },
        { href: '/dashboard/pagos', label: 'Pagos', icon: DollarSign },
        { href: '/dashboard/cancelados', label: 'Cancelados', icon: XCircle },
      ],
    },
    {
      label: 'Cuenta',
      items: [
        { href: '/dashboard/perfil-publico', label: 'Perfil Público', icon: User },
        { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const NavLink = ({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: React.ElementType; mobile?: boolean }) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive(href)
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon className={cn('shrink-0', mobile ? 'h-5 w-5' : 'h-4 w-4')} />
      {label}
    </Link>
  );

  async function refreshNotifications() {
    const response = await fetchWithAuth('/api/dashboard/notifications');
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(data.notifications || []);
    setUnreadCount(data.unreadCount || 0);
  }

  async function markNotificationAsRead(notificationId: string) {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const response = await fetchWithAuth('/api/dashboard/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        return;
      }
    } catch {
      // fallback refresh
    }

    await refreshNotifications();
  }

  async function handleNotificationOpen(notification: DashboardNotification) {
    await markNotificationAsRead(notification.id);
    router.push(notification.href || '/dashboard/notificaciones');
  }

  const NotificationBell = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notificaciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-2xl border-border/50 shadow-[0_8px_40px_rgba(0,0,0,0.12)] bg-card/95 backdrop-blur-xl p-1"
      >
        <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold flex items-center justify-between">
          Notificaciones
          {unreadCount > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sin notificaciones nuevas</div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="p-0 rounded-xl focus:bg-secondary"
              onSelect={(event) => {
                event.preventDefault();
                void handleNotificationOpen(notification);
              }}
            >
              <button type="button" className="flex w-full items-start gap-3 px-3 py-2.5 rounded-xl text-left">
                <div className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  notification.type === 'pending_appointment'
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : notification.type === 'patient_confirmed'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : notification.type === 'patient_declined'
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                )}>
                  {notification.type === 'pending_appointment'
                    ? <Calendar className="h-3.5 w-3.5 text-amber-600" />
                    : notification.type === 'patient_confirmed'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : notification.type === 'patient_declined'
                        ? <XCircle className="h-3.5 w-3.5 text-red-600" />
                        : <Bell className="h-3.5 w-3.5 text-blue-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                </div>
              </button>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem asChild className="justify-center text-sm font-medium text-primary rounded-xl py-2 focus:bg-accent focus:text-accent-foreground">
          <Link href="/dashboard/notificaciones">Ver todas las notificaciones →</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden border-r border-border/50 bg-card/90 backdrop-blur-md md:flex md:flex-col">
        {/* Logo + Bell */}
        <div className="flex h-[60px] shrink-0 items-center border-b border-border/40 px-4 gap-2">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold min-w-0">
            <Logo />
          </Link>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Trial callout */}
        <div className="shrink-0 px-3 pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold text-primary">10 días de prueba</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2.5">
              Actualiza para acceder a todas las funciones sin límites.
            </p>
            <Button size="sm" className="w-full text-xs h-8 rounded-xl shadow-sm">
              Actualizar Plan
            </Button>
          </div>
        </div>

        {/* User at bottom */}
        <div className="shrink-0 border-t border-border/40 px-3 py-3">
          <UserNav sidebar />
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="flex flex-col min-w-0">
        {/* Mobile header — hidden on desktop since sidebar handles logo + user */}
        <header className="flex md:hidden h-[60px] shrink-0 items-center gap-3 border-b border-border/50 bg-card/80 backdrop-blur-md px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col w-72 p-0 bg-card/98 backdrop-blur-2xl border-r border-border/40">
              <SheetTitle className="sr-only">Menú</SheetTitle>

              {/* Mobile logo */}
              <div className="flex h-[60px] items-center border-b border-border/40 px-4">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Logo />
                </Link>
              </div>

              {/* Mobile nav */}
              <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
                {navGroups.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                        {group.label}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <NavLink key={item.href} {...item} mobile />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Mobile trial */}
              <div className="shrink-0 px-3 pb-3">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-primary">10 días de prueba</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2.5">Actualiza para todas las funciones.</p>
                  <Button size="sm" className="w-full text-xs h-8 rounded-xl">Actualizar Plan</Button>
                </div>
              </div>

              {/* Mobile user */}
              <div className="shrink-0 border-t border-border/40 px-3 py-3">
                <UserNav sidebar />
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile: logo center + bell right */}
          <div className="flex flex-1 items-center justify-between md:hidden">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo />
            </Link>
            <NotificationBell />
          </div>

          {/* Desktop: spacer — user is in sidebar bottom */}
          <div className="hidden md:flex flex-1" />
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 md:p-5 lg:gap-6 lg:p-7 bg-background overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
