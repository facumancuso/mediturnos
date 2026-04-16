'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { XCircle, Search, CalendarX } from 'lucide-react';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { Appointment } from '@/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const typeLabels: Record<string, string> = {
  first_time: 'Primera vez',
  checkup: 'Control',
  urgent: 'Urgente',
};

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp-like
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

export default function CanceladosPage() {
  const { user } = useUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.uid) return;

    async function fetchCancelled() {
      setLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/dashboard/appointments?professionalId=${user!.uid}&status=cancelled`
        );
        if (res.ok) {
          const data = await res.json();
          // Sort by most recently cancelled
          const sorted = (data as Appointment[]).sort((a, b) => {
            const dateA = safeDate(a.cancelledAt ?? a.updatedAt)?.getTime() ?? 0;
            const dateB = safeDate(b.cancelledAt ?? b.updatedAt)?.getTime() ?? 0;
            return dateB - dateA;
          });
          setAppointments(sorted);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }

    fetchCancelled();
  }, [user?.uid]);

  const filtered = appointments.filter((a) =>
    a.patientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <XCircle className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos Cancelados</h1>
          <p className="text-sm text-muted-foreground">
            Historial de turnos que fueron cancelados
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Registro de cancelaciones</CardTitle>
              <CardDescription>
                {loading ? 'Cargando...' : `${appointments.length} turno${appointments.length !== 1 ? 's' : ''} cancelado${appointments.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <CalendarX className="h-12 w-12 opacity-30" />
              <p className="text-sm">
                {search ? 'No se encontraron resultados' : 'No hay turnos cancelados'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Turno original</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cancelado el</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((appt) => {
                  const appointmentDate = safeDate(appt.date);
                  const cancelledDate = safeDate(appt.cancelledAt ?? appt.updatedAt);

                  return (
                    <TableRow key={appt.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={appt.patientAvatarUrl} />
                            <AvatarFallback className="text-xs">
                              {appt.patientName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{appt.patientName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {appointmentDate
                          ? format(appointmentDate, "dd 'de' MMMM yyyy", { locale: es })
                          : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">{appt.time} hs</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {typeLabels[appt.type] ?? appt.type}
                      </TableCell>
                      <TableCell>
                        {cancelledDate ? (
                          <span className="text-sm text-destructive font-medium">
                            {format(cancelledDate, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
