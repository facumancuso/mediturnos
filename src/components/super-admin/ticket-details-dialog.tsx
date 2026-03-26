'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { SupportTicket, SuperAdminTeamMember } from '@/types';
import { mockSuperAdminTeam } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, User, Calendar, Tag, CheckCircle, Clock, UserPlus } from 'lucide-react';


type TicketDetailsDialogProps = {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (ticket: SupportTicket) => void;
};

export function TicketDetailsDialog({ ticket, open, onOpenChange, onUpdate }: TicketDetailsDialogProps) {
    const { toast } = useToast();
    const [reply, setReply] = useState('');
    const [currentStatus, setCurrentStatus] = useState<SupportTicket['status'] | undefined>();
    const [currentPriority, setCurrentPriority] = useState<SupportTicket['priority'] | undefined>();
    const [currentAssignee, setCurrentAssignee] = useState<string | undefined>();
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        if (ticket) {
            setCurrentStatus(ticket.status);
            setCurrentPriority(ticket.priority);
            setCurrentAssignee(ticket.assignedTo || 'unassigned');
        }
        if (open) {
          setIsClient(true);
        }
    }, [ticket, open]);

    if (!ticket) return null;

    const handleSave = () => {
        let hasChanges = false;
        const newHistory = [...ticket.history];
        const now = new Date().toISOString();

        if (reply.trim()) {
            newHistory.push({ type: 'reply', content: reply, date: now, author: 'Soporte' });
            hasChanges = true;
        }
        if (currentStatus && currentStatus !== ticket.status) {
            newHistory.push({ type: 'status_change', content: `Estado cambiado a "${currentStatus}"`, date: now, author: 'Soporte' });
            hasChanges = true;
        }
        if (currentPriority && currentPriority !== ticket.priority) {
            newHistory.push({ type: 'priority_change', content: `Prioridad cambiada a "${currentPriority}"`, date: now, author: 'Soporte' });
            hasChanges = true;
        }
        if (currentAssignee && currentAssignee !== (ticket.assignedTo || 'unassigned')) {
             const assigneeName = mockSuperAdminTeam.find(m => m.id === currentAssignee)?.name || 'Nadie';
             newHistory.push({ type: 'assignment', content: `Ticket asignado a ${assigneeName}`, date: now, author: 'Soporte' });
             hasChanges = true;
        }

        if (hasChanges) {
            const updatedTicket: SupportTicket = {
                ...ticket,
                status: currentStatus!,
                priority: currentPriority!,
                assignedTo: currentAssignee === 'unassigned' ? undefined : currentAssignee,
                history: newHistory,
            };
            onUpdate(updatedTicket);
            toast({ title: 'Ticket actualizado', description: 'Los cambios han sido guardados.' });
        } else {
             toast({ title: 'Sin cambios', description: 'No se realizaron cambios en el ticket.', variant: 'default' });
        }
        
        setReply('');
        onOpenChange(false);
    };

    const historyIcons = {
        created: User,
        reply: MessageSquare,
        status_change: CheckCircle,
        priority_change: Tag,
        assignment: UserPlus,
    };

    return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{ticket.subject}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-6 h-[calc(100%-80px)]">
            {/* Main content: History and Reply */}
            <div className="col-span-2 flex flex-col h-full">
                <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="space-y-6">
                        {/* Original Message */}
                        <Card>
                             <CardContent className="p-4 flex gap-4">
                                <Avatar className="h-10 w-10 border">
                                    <AvatarImage src={ticket.professionalAvatar} />
                                    <AvatarFallback>{ticket.professionalName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold">{ticket.professionalName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {isClient ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: es }) : '...'}
                                        </p>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{ticket.description}</p>
                                </div>
                             </CardContent>
                        </Card>
                        {/* History */}
                        <div className="relative pl-6">
                            <div className="absolute left-6 top-0 h-full w-px bg-border -translate-x-1/2"></div>
                            {ticket.history.slice(1).map((item, index) => {
                                const Icon = historyIcons[item.type];
                                return (
                                    <div key={index} className="relative flex items-start gap-4 mb-6">
                                        <div className="absolute left-0 top-1.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="h-3 w-3" /></div>
                                        </div>
                                        <div className="text-sm font-medium text-muted-foreground w-20 text-right pt-1 pr-2">
                                            {isClient ? formatDistanceToNow(new Date(item.date), { locale: es }) : '...'}
                                        </div>
                                        <div className="flex-1">
                                            {item.type === 'reply' ? (
                                                <Card className="bg-primary/5">
                                                    <CardContent className="p-3">
                                                        <p className="font-semibold text-sm">{item.author}</p>
                                                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                                                    </CardContent>
                                                </Card>
                                            ) : (
                                                <p className="text-sm text-muted-foreground pt-1 italic">{item.content}</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </ScrollArea>
                <div className="pt-4 space-y-2">
                    <Label htmlFor="reply" className="font-semibold">Responder al Profesional</Label>
                    <Textarea id="reply" placeholder="Escribe tu respuesta..." className="min-h-[100px]" value={reply} onChange={(e) => setReply(e.target.value)} />
                </div>
            </div>

            {/* Sidebar: Details and Actions */}
            <div className="col-span-1 bg-muted/50 rounded-lg p-4 flex flex-col gap-6">
                 <div>
                    <h4 className="font-semibold mb-2">Detalles</h4>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">ID Ticket:</span> <span className="font-mono text-xs">{ticket.id}</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Profesional:</span> <span className="font-medium">{ticket.professionalName}</span></div>
                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{isClient ? format(new Date(ticket.createdAt), "dd/MM/yy HH:mm") : '...'}</span></div>
                    </div>
                 </div>
                 <Separator />
                 <div className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="status-select">Estado</Label>
                        <Select value={currentStatus} onValueChange={(v) => setCurrentStatus(v as SupportTicket['status'])}>
                            <SelectTrigger id="status-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Abierto">Abierto</SelectItem>
                                <SelectItem value="En proceso">En proceso</SelectItem>
                                <SelectItem value="Resuelto">Resuelto</SelectItem>
                                <SelectItem value="Cerrado">Cerrado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="priority-select">Prioridad</Label>
                        <Select value={currentPriority} onValueChange={(v) => setCurrentPriority(v as SupportTicket['priority'])}>
                            <SelectTrigger id="priority-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Baja">Baja</SelectItem>
                                <SelectItem value="Media">Media</SelectItem>
                                <SelectItem value="Alta">Alta</SelectItem>
                                <SelectItem value="Urgente">Urgente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="assign-select">Asignar a</Label>
                        <Select value={currentAssignee} onValueChange={setCurrentAssignee}>
                            <SelectTrigger id="assign-select"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Sin asignar</SelectItem>
                                <Separator />
                                {mockSuperAdminTeam.map(member => (
                                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
            </div>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar y Enviar Respuesta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    );
}
