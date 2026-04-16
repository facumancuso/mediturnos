'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Calendar, Users, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_ITEMS = 'mediturnos-onboarding-dismissed-items';
const STORAGE_HIDDEN = 'mediturnos-onboarding-hidden';

const checklistItems = [
  { id: 'horarios', label: 'Configurar horarios', href: '/dashboard/configuracion', icon: Calendar },
  { id: 'google', label: 'Conectar Calendario de Google', href: '/dashboard/configuracion', icon: Calendar },
  { id: 'paciente', label: 'Agregar primer paciente', href: '/dashboard/pacientes', icon: Users },
  { id: 'perfil', label: 'Activar perfil público', href: '/dashboard/perfil-publico', icon: User },
] as const;

export function OnboardingChecklist() {
  const [hydrated, setHydrated] = useState(false);
  const [fullyHidden, setFullyHidden] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(STORAGE_HIDDEN);
      if (hidden === '1') setFullyHidden(true);
      const raw = localStorage.getItem(STORAGE_ITEMS);
      if (raw) setDismissedIds(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const dismissItem = useCallback((id: string) => {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(STORAGE_ITEMS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const hideEntireCard = useCallback(() => {
    setFullyHidden(true);
    try {
      localStorage.setItem(STORAGE_HIDDEN, '1');
    } catch {
      /* ignore */
    }
  }, []);

  if (!hydrated) {
    return null;
  }

  if (fullyHidden) {
    return null;
  }

  const visibleItems = checklistItems.filter((item) => !dismissedIds.includes(item.id));

  if (visibleItems.length === 0) {
    return null;
  }

  const progress = ((checklistItems.length - visibleItems.length) / checklistItems.length) * 100;

  return (
    <Card className="relative">
      <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={hideEntireCard}>
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </Button>
      <CardHeader>
        <CardTitle>¡Bienvenido a MediTurnos!</CardTitle>
        <CardDescription>Sigue estos pasos para configurar tu cuenta y empezar a gestionar tu consultorio.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => dismissItem(item.id)}
              className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Progreso</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      </CardContent>
    </Card>
  );
}
