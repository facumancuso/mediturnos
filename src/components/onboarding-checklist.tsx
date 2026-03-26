'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, Calendar, Users, User, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const checklistItems = [
  { id: 'horarios', label: 'Configurar horarios', href: '/dashboard/configuracion', icon: Calendar },
  { id: 'google', label: 'Conectar Google Calendar', href: '/dashboard/configuracion', icon: Calendar },
  { id: 'paciente', label: 'Agregar primer paciente', href: '/dashboard/pacientes', icon: Users },
  { id: 'perfil', label: 'Activar perfil público', href: '/dashboard/perfil-publico', icon: User },
];

export function OnboardingChecklist() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  const handleCheckChange = (id: string, checked: boolean) => {
    if (checked) {
      setCheckedItems((prev) => [...prev, id]);
    } else {
      setCheckedItems((prev) => prev.filter((item) => item !== id));
    }
  };

  const progress = (checkedItems.length / checklistItems.length) * 100;

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="relative">
      <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => setIsVisible(false)}>
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </Button>
      <CardHeader>
        <CardTitle>¡Bienvenido a MediTurnos!</CardTitle>
        <CardDescription>Sigue estos pasos para configurar tu cuenta y empezar a gestionar tu consultorio.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checklistItems.map((item) => {
            const isChecked = checkedItems.includes(item.id);
            return (
              <Link key={item.id} href={item.href} className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            isChecked ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                        )}>
                            {isChecked ? <CheckCircle className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
                        </div>
                        <span className={cn("font-medium", isChecked && "line-through text-muted-foreground")}>
                            {item.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                       <Checkbox
                          id={item.id}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleCheckChange(item.id, !!checked)}
                          onClick={(e) => e.preventDefault()} // Prevent link navigation on checkbox click
                          className="h-5 w-5"
                        />
                       <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Progreso</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      </CardContent>
    </Card>
  );
}
