'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ManagedProfessional } from '@/types';
import { cn } from '@/lib/utils';

const statusStyles: { [key in ManagedProfessional['status']]: string } = {
    Activa: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    Vencida: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
    Bloqueada: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    'En prueba': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
};


type ProfessionalDetailsDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfessionalDetailsDialog({ professional, open, onOpenChange }: ProfessionalDetailsDialogProps) {
  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalles del Profesional</DialogTitle>
          <DialogDescription>
            Información detallada del profesional, incluyendo plan y estado de la cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={professional.avatarUrl} alt={professional.name} />
                    <AvatarFallback>{professional.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-xl">{professional.name}</p>
                    <p className="text-sm text-muted-foreground">{professional.email}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <Label className="text-muted-foreground">Plan</Label>
                    <div className="font-medium pt-1"><Badge variant="outline">{professional.plan}</Badge></div>
                </div>
                <div>
                    <Label className="text-muted-foreground">Estado</Label>
                     <div className="font-medium pt-1">
                        <Badge variant="outline" className={cn('border', statusStyles[professional.status])}>
                            {professional.status}
                        </Badge>
                     </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Verificación</Label>
                  <p className="font-medium">{professional.verified ? 'Perfil verificado' : 'Perfil no verificado'}</p>
                </div>
                <div>
                    <Label className="text-muted-foreground">DNI</Label>
                    <p className="font-mono">{professional.dni || 'No especificado'}</p>
                </div>
                <div>
                    <Label className="text-muted-foreground">Teléfono</Label>
                    <p className="font-medium">{professional.phone || 'No especificado'}</p>
                </div>
                 <div>
                    <Label className="text-muted-foreground">Último Pago</Label>
                    <p className="font-medium">{professional.lastPayment.split('-').reverse().join('/')}</p>
                </div>
                <div>
                    <Label className="text-muted-foreground">ID de Cliente</Label>
                    <p className="font-mono text-xs">{professional.id}</p>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
