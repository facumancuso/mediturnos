'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ManagedProfessional } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { addDays, format } from 'date-fns';

type ExtendTrialDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtend: (professionalId: string, newTrialEndDate: string) => void;
};

export function ExtendTrialDialog({ professional, open, onOpenChange, onExtend }: ExtendTrialDialogProps) {
  const { toast } = useToast();
  
  if (!professional) return null;

  const handleExtend = (days: number) => {
    const currentTrialEnd = professional.trialEndsAt ? new Date(professional.trialEndsAt) : new Date();
    const newTrialEndDate = addDays(currentTrialEnd, days);
    const formattedNewDate = newTrialEndDate.toISOString().split('T')[0];

    onExtend(professional.id, formattedNewDate);
    toast({
        title: "Período de prueba extendido",
        description: `La prueba de ${professional.name} ha sido extendida por ${days} días.`,
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extender Período de Prueba</DialogTitle>
          <DialogDescription>
            Extiende el período de prueba para {professional.name}.
            {professional.trialEndsAt && ` Su prueba actual termina el ${format(new Date(professional.trialEndsAt), 'dd/MM/yyyy')}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid grid-cols-3 gap-2">
            <Button onClick={() => handleExtend(7)}>+7 Días</Button>
            <Button onClick={() => handleExtend(15)}>+15 Días</Button>
            <Button onClick={() => handleExtend(30)}>+30 Días</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
