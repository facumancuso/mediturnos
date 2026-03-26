'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ManagedProfessional, ActivityLogEntry } from '@/types';
import { mockActivityLogs } from '@/lib/mock-data';
import { CalendarPlus, CheckCircle, XCircle, DollarSign, UserCog } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type ActivityLogDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const activityIcons: { [key in ActivityLogEntry['type']]: React.ElementType } = {
  appointment_created: CalendarPlus,
  appointment_completed: CheckCircle,
  appointment_cancelled: XCircle,
  payment_received: DollarSign,
  profile_updated: UserCog,
};

const activityColors: { [key in ActivityLogEntry['type']]: string } = {
  appointment_created: 'text-blue-500',
  appointment_completed: 'text-green-500',
  appointment_cancelled: 'text-red-500',
  payment_received: 'text-emerald-500',
  profile_updated: 'text-purple-500',
};


export function ActivityLogDialog({ professional, open, onOpenChange }: ActivityLogDialogProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    if (open) {
      setIsClient(true);
    }
  }, [open]);
  
  if (!professional) return null;

  const logs = mockActivityLogs[professional.id] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registro de Actividad</DialogTitle>
          <DialogDescription>
            Actividad reciente para {professional.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-96 pr-4">
            <div className="relative pl-6">
              <div className="absolute left-6 top-0 h-full w-px bg-border -translate-x-1/2"></div>
                <div className="space-y-8">
                    {logs.length > 0 ? logs.map((log) => {
                        const Icon = activityIcons[log.type];
                        return (
                            <div key={log.id} className="relative flex items-start gap-4">
                                <div className="absolute left-0 top-1 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                        <Icon className={`h-4 w-4 ${activityColors[log.type]}`} />
                                    </div>
                                </div>
                                <div className="flex-1 ml-8">
                                    <p className="font-medium text-sm">{log.description}</p>
                                    <div className="flex items-center gap-2">
                                        {isClient ? (
                                        <p className="text-xs text-muted-foreground" title={format(new Date(log.date), "PPpp", { locale: es })}>
                                            {formatDistanceToNow(new Date(log.date), { addSuffix: true, locale: es })}
                                        </p>
                                        ) : (
                                        <div className="h-4 mt-1 w-20 rounded bg-muted animate-pulse"></div>
                                        )}
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <p className="text-xs text-muted-foreground">por <span className="font-medium">{log.author}</span></p>
                                    </div>
                                </div>
                            </div>
                        )
                    }) : (
                         <div className="text-center py-16 text-muted-foreground">
                            <p>No hay actividad registrada para este usuario.</p>
                        </div>
                    )}
                </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
