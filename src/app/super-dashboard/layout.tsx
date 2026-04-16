'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import {
  Users,
  CreditCard,
  Settings,
  Shield,
  ShieldAlert,
  Menu,
  LayoutGrid,
  LifeBuoy,
  Bell,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { useFirestore, useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

export default function SuperDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isRoleChecked, setIsRoleChecked] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    const currentUser = user;

    let cancelled = false;

    async function validateSuperAdminRole() {
      try {
        const roleDoc = await getDoc(doc(firestore, 'roles_super_admin', currentUser.uid));
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        const userRole = String(userDoc.data()?.role || '').toLowerCase();
        const isSuperAdminUserDoc =
          userDoc.exists() && (userRole === 'super_admin' || userRole === 'super-admin');

        if (!roleDoc.exists() && !isSuperAdminUserDoc) {
          router.replace('/dashboard');
          return;
        }

        if (!cancelled) {
          setIsRoleChecked(true);
          fetchWithAuth('/api/super-dashboard/professionals/self', {
            method: 'PATCH',
          }).catch((cleanupError) => {
            console.error('No se pudo sanear perfil super-admin en MongoDB:', cleanupError);
          });
        }
      } catch (error) {
        console.error('Error validando rol super admin:', error);
        router.replace('/dashboard');
      }
    }

    validateSuperAdminRole();

    return () => {
      cancelled = true;
    };
  }, [isUserLoading, user?.uid, firestore, router]);

  if (isUserLoading || !user || !isRoleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando permisos...
      </div>
    );
  }

  const navItems = [
    { href: '/super-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { href: '/super-dashboard/clientes', label: 'Clientes', icon: Users },
    { href: '/super-dashboard/alertas', label: 'Alertas', icon: Bell },
    { href: '/super-dashboard/seguridad', label: 'Seguridad', icon: ShieldAlert },
    { href: '/super-dashboard/planes', label: 'Planes y Configuración', icon: CreditCard },
    { href: '/super-dashboard/soporte', label: 'Soporte', icon: LifeBuoy },
    { href: '/super-dashboard/configuracion', label: 'Configuración de Pagos', icon: Settings },
  ];

  const SuperAdminLogo = () => (
     <div className="flex items-center gap-2" aria-label="MediTurnos Super Admin Logo">
      <Shield className="h-7 w-7 text-primary" />
      <span className="text-xl font-bold tracking-tight">Super Admin</span>
    </div>
  )

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/super-dashboard" className="flex items-center gap-2 font-semibold">
              <SuperAdminLogo />
            </Link>
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
                </Link>
              ))}
            </nav>
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
                <span className="sr-only">Abrir menú de navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetTitle className="sr-only">Menú de administración</SheetTitle>
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="/super-dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <SuperAdminLogo />
                </Link>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            {/* Page title will be rendered by each page */}
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
