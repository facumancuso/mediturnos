'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ManagedProfessional } from '@/types';
import { useToast } from '@/hooks/use-toast';

type UpgradePlanDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: (professionalId: string, newPlan: ManagedProfessional['plan']) => void;
};

export function UpgradePlanDialog({ professional, open, onOpenChange, onUpgrade }: UpgradePlanDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<ManagedProfessional['plan'] | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    if (professional) {
      setSelectedPlan(professional.plan);
    }
  }, [professional]);

  if (!professional) return null;

  const handleSave = () => {
    if (selectedPlan) {
        onUpgrade(professional.id, selectedPlan);
        toast({
            title: "Plan actualizado",
            description: `El plan de ${professional.name} ha sido actualizado a ${selectedPlan}.`,
        });
        onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mejorar Plan</DialogTitle>
          <DialogDescription>
            Selecciona el nuevo plan para {professional.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div>
                <p className="text-sm text-muted-foreground">Plan Actual: <span className="font-semibold text-foreground">{professional.plan}</span></p>
            </div>
            <div>
                <Label htmlFor="plan-select">Nuevo Plan</Label>
                <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as ManagedProfessional['plan'])}>
                    <SelectTrigger id="plan-select" className="mt-1">
                        <SelectValue placeholder="Seleccionar nuevo plan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Básico">Básico</SelectItem>
                        <SelectItem value="Profesional">Profesional</SelectItem>
                        <SelectItem value="Clínica">Clínica</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedPlan || selectedPlan === professional.plan}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
