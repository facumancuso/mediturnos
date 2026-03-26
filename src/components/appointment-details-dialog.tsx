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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Appointment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Send } from 'lucide-react';

const statusLabels: { [key in Appointment['status']]: string } = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    completed: 'Completado',
    cancelled: 'Cancelado',
    no_show: 'No asistió',
};

const statusStyles: { [key in Appointment['status']]: string } = {
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

type AppointmentDetailsDialogProps = {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AppointmentDetailsDialog({ appointment, open, onOpenChange }: AppointmentDetailsDialogProps) {
  const [currentStatus, setCurrentStatus] = useState<Appointment['status'] | undefined>(appointment?.status);
  const [currentNotes, setCurrentNotes] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (appointment) {
      setCurrentStatus(appointment.status);
      setCurrentNotes(appointment.notes || '');
      setLinkSent(false); // Reset on new appointment
    }
  }, [appointment, open]);

  if (!appointment) {
    return null;
  }

  const handleSave = () => {
    console.log(`Updating appointment ${appointment.id} status to ${currentStatus} and notes: ${currentNotes}`);
    toast({
      title: 'Turno actualizado',
      description: `El turno de ${appointment.patientName} ha sido actualizado.`,
    });
    // Do not close the dialog if the status was just changed to 'completed'
    if (currentStatus !== 'completed') {
        onOpenChange(false);
    }
  };

  const handleSendReviewLink = () => {
    setLinkSent(true);
    toast({
        title: 'Enlace de calificación enviado',
        description: `Se ha enviado un enlace único a ${appointment.patientName} para que califique la atención.`,
    })
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalles del Turno</DialogTitle>
          <DialogDescription>
            {new Date(appointment.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} a las {appointment.time}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                 <Avatar className="h-12 w-12">
                    <AvatarImage src={appointment.patientAvatarUrl} alt={appointment.patientName} />
                    <AvatarFallback>{appointment.patientName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-lg">{appointment.patientName}</p>
                    <p className="text-sm text-muted-foreground">Paciente</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label className="text-sm text-muted-foreground">Estado actual</Label>
                    <Badge variant="outline" className={`${statusStyles[appointment.status]} border-none text-base mt-1`}>{statusLabels[appointment.status]}</Badge>
                </div>
                 <div>
                    <Label htmlFor="status-select" className="text-sm">Cambiar estado</Label>
                    <Select value={currentStatus} onValueChange={(value) => setCurrentStatus(value as Appointment['status'])}>
                        <SelectTrigger id="status-select" className="mt-1">
                            <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(statusLabels).map(([status, label]) => (
                                <SelectItem key={status} value={status}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="space-y-2 pt-2">
                <Label htmlFor="notes">Notas de la Consulta</Label>
                <Textarea
                    id="notes"
                    placeholder="Añadir notas privadas sobre la consulta..."
                    value={currentNotes}
                    onChange={(e) => setCurrentNotes(e.target.value)}
                    className="min-h-[100px]"
                />
            </div>
            {currentStatus === 'completed' && (
                <div className="pt-2">
                    <Button 
                        className="w-full" 
                        onClick={handleSendReviewLink}
                        disabled={linkSent}
                    >
                        <Send className="mr-2 h-4 w-4" />
                        {linkSent ? 'Enlace de calificación enviado' : 'Enviar enlace para calificación'}
                    </Button>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
              {currentStatus === 'completed' ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button onClick={handleSave}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
