'use client';

import { useState, useMemo, useEffect } from 'react';
import { MoreHorizontal, Search, Ticket } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { mockSupportTickets } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { SupportTicket } from '@/types';
import { TicketDetailsDialog } from '@/components/super-admin/ticket-details-dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SuperDashboardSoportePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>(mockSupportTickets);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => 
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tickets, searchTerm]);

  const handleOpenDialog = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsDetailsOpen(true);
  };
  
  const handleTicketUpdate = (updatedTicket: SupportTicket) => {
    setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
  };

  const priorityStyles: { [key in SupportTicket['priority']]: string } = {
    Urgente: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    Alta: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700',
    Media: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    Baja: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
  };

  const statusStyles: { [key in SupportTicket['status']]: string } = {
    Abierto: 'bg-green-100 text-green-800 border-green-200',
    'En proceso': 'bg-blue-100 text-blue-800 border-blue-200',
    Resuelto: 'bg-purple-100 text-purple-800 border-purple-200',
    Cerrado: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Centro de Soporte</h1>
        <p className="text-muted-foreground">
          Gestiona todos los tickets de soporte de los profesionales.
        </p>
      </header>
      <Card>
        <CardHeader>
            <CardTitle>Bandeja de Entrada</CardTitle>
            <CardDescription>{tickets.filter(t => t.status === 'Abierto').length} tickets abiertos de un total de {tickets.length}.</CardDescription>
          <div className="relative pt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por asunto, profesional o ID..." 
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} className="cursor-pointer" onClick={() => handleOpenDialog(ticket)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={ticket.professionalAvatar} alt="Avatar" />
                        <AvatarFallback>{ticket.professionalName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className='flex flex-col'>
                        <div className="font-medium">{ticket.professionalName}</div>
                        <div className="text-xs text-muted-foreground">ID: {ticket.professionalId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{ticket.subject}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{ticket.description}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={cn('border font-semibold', priorityStyles[ticket.priority])}>
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={cn('border', statusStyles[ticket.status])}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {isClient ? (
                      <div title={format(new Date(ticket.createdAt), "PPpp", { locale: es })}>
                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: es })}
                      </div>
                    ) : (
                      <div className="h-5 w-24 rounded bg-muted animate-pulse"></div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleOpenDialog(ticket)}>
                          Ver / Responder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
                {filteredTickets.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                            <Ticket className="mx-auto h-12 w-12" />
                            <p className="mt-4">No se encontraron tickets.</p>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TicketDetailsDialog 
        ticket={selectedTicket}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={handleTicketUpdate}
      />
    </div>
  );
}
