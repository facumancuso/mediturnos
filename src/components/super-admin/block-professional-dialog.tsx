'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ManagedProfessional } from '@/types';
import { useToast } from '@/hooks/use-toast';

type BlockProfessionalDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (professionalId: string) => void;
};

export function BlockProfessionalDialog({ professional, open, onOpenChange, onConfirm }: BlockProfessionalDialogProps) {
  const { toast } = useToast();
  
  if (!professional) return null;
  
  const isBlocked = professional.status === 'Bloqueada';
  const actionText = isBlocked ? 'Desbloquear' : 'Bloquear';
  const title = `${actionText} Profesional`;
  const description = `¿Estás seguro de que quieres ${isBlocked ? 'desbloquear' : 'bloquear'} a ${professional.name}? ${isBlocked ? 'El profesional podrá volver a acceder a su cuenta.' : 'El profesional no podrá acceder a su cuenta hasta que sea desbloqueado.'}`;

  const handleConfirm = () => {
    onConfirm(professional.id);
    toast({
        title: `Profesional ${isBlocked ? 'desbloqueado' : 'bloqueado'}`,
        description: `${professional.name} ha sido ${isBlocked ? 'desbloqueado' : 'bloqueado'} exitosamente.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={handleConfirm}
            className={!isBlocked ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
