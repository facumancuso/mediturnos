'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Appointment, Patient } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusStyles: { [key in Appointment['status']]: string } = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const statusLabels: { [key in Appointment['status']]: string } = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No asistió',
};

export default function PatientPortalPage() {
  const [dni, setDni] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!dni.trim()) {
      setError('Por favor, ingresá tu DNI.');
      return;
    }

    setIsLoading(true);
    setError('');
    setPatient(null);
    setAppointments([]);
    setSearched(false);

    try {
      const params = new URLSearchParams({ dni: dni.trim() });
      const response = await fetch(`/api/patient/appointments?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'No se pudieron obtener los turnos.');
        return;
      }

      setPatient(data.patient);
      setAppointments(data.appointments || []);
      setSearched(true);
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Consulta de Turnos</CardTitle>
          <CardDescription>Ingresá tu DNI para ver tus próximos turnos e historial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="dni">DNI (sin puntos)</Label>
              <Input
                id="dni"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="12345678"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          <Button onClick={handleSearch} disabled={isLoading} className="w-full">
            {isLoading ? 'Buscando...' : 'Buscar mis turnos'}
          </Button>

          {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}

          {searched && patient && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold">Turnos de {patient.name}</h3>
              {appointments.length === 0 ? (
                <p className="text-center text-muted-foreground">No tenés turnos registrados.</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appt) => {
                    const apptDate = appt.date instanceof Date ? appt.date : new Date(appt.date as unknown as string);
                    return (
                      <div
                        key={appt.id}
                        className="border p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                      >
                        <div>
                          <p className="font-bold">
                            {format(apptDate, "eeee dd 'de' MMMM", { locale: es })} — {appt.time} hs
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">{appt.type?.replace('_', ' ')}</p>
                        </div>
                        <Badge variant="outline" className={`${statusStyles[appt.status]} border-none`}>
                          {statusLabels[appt.status]}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
