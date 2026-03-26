'use client';

import Link from 'next/link';
import {
  Bell,
  Calendar,
  CheckCircle,
  Contact,
  DollarSign,
  Home,
  LineChart,
  Menu,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  function isSuperAdminEmail(email?: string | null) {
    const normalized = (email || '').toLowerCase();
    const configured = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'admin@mediturnos.com').toLowerCase();
    return normalized !== '' && normalized === configured;
  }

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    let cancelled = false;

    async function validateDashboardAccess() {
      const currentEmail = (user.email || '').toLowerCase();

      if (isSuperAdminEmail(currentEmail)) {
        router.replace('/super-dashboard');
        return;
      }

      try {
        const superAdminDoc = await getDoc(doc(firestore, 'roles_super_admin', user.uid));
        if (superAdminDoc.exists()) {
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

  // Auto-sync: asegura que el profesional existe en MongoDB al entrar al dashboard
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const currentEmail = (user.email || '').toLowerCase();

    async function syncProfessionalIfNeeded() {
      if (isSuperAdminEmail(currentEmail)) {
        return;
      }

      try {
        const superAdminDoc = await getDoc(doc(firestore, 'roles_super_admin', uid));
        if (superAdminDoc.exists()) {
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

  if (isUserLoading || !user || !accessChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando acceso...
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard', label: 'Hoy', icon: Home },
    { href: '/dashboard/calendario', label: 'Calendario', icon: Calendar },
    { href: '/dashboard/pacientes', label: 'Pacientes', icon: Users, badge: '6' },
    { href: '/dashboard/reportes', label: 'Reportes', icon: LineChart },
    { href: '/dashboard/equipo', label: 'Equipo', icon: Contact },
    { href: '/dashboard/pagos', label: 'Pagos', icon: DollarSign },
    { href: '/dashboard/perfil-publico', label: 'Perfil Público', icon: User },
    { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Logo />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="ml-auto h-8 w-8 relative">
                  <div className="absolute flex items-center justify-center -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs">2</div>
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Toggle notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="p-0">
                  <Link href="#" className="flex w-full items-start gap-3 rounded-sm px-2 py-1.5">
                    <Calendar className="mt-1 h-4 w-4 text-primary" />
                    <div>
                        <p className="font-medium text-sm">Nuevo turno agendado</p>
                        <p className="text-xs text-muted-foreground">Carlos Sánchez para hoy a las 15:30.</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="p-0">
                   <Link href="#" className="flex w-full items-start gap-3 rounded-sm px-2 py-1.5">
                    <CheckCircle className="mt-1 h-4 w-4 text-green-500" />
                    <div>
                        <p className="font-medium text-sm">Turno Confirmado</p>
                        <p className="text-xs text-muted-foreground">Ana García ha confirmado su asistencia para mañana.</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="py-2 text-center text-sm text-muted-foreground">
                  <Link href="#">Ver todas las notificaciones</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.badge && (
                    <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Card>
              <CardHeader className="p-2 pt-0 md:p-4">
                <CardTitle>Prueba Gratuita</CardTitle>
                <CardDescription>
                  Te quedan 10 días de prueba. Actualiza a un plan superior para desbloquear todas las funciones.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0 md:p-4 md:pt-0">
                <Button size="sm" className="w-full">
                  Actualizar Plan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <Logo />
                </Link>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                    {item.badge && (
                      <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Prueba Gratuita</CardTitle>
                    <CardDescription>
                      Te quedan 10 días de prueba. Actualiza para desbloquear todas las funciones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="w-full">
                      Actualizar Plan
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            {/* Can add a search bar here if needed */}
          </div>
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
            {children}
        </main>
      </div>
    </div>
  );
}
