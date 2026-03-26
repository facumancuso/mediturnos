'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { allAppointments } from '@/lib/mock-data';
import type { Appointment } from '@/types';
import { Badge } from '@/components/ui/badge';

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
}


export default function PatientPortalPage() {
    const [dni, setDni] = useState('');
    const [searchedDni, setSearchedDni] = useState('');
    const [foundAppointments, setFoundAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = () => {
        setIsLoading(true);
        setError('');
        setFoundAppointments([]);
        
        // Simulate API call
        setTimeout(() => {
            const cleanDni = dni.replace(/\./g, '');
            if (cleanDni) {
                const appointments = allAppointments.filter(appt => appt.patientId === cleanDni);
                if (appointments.length > 0) {
                    setFoundAppointments(appointments.sort((a, b) => b.date.getTime() - a.date.getTime()));
                } else {
                    setError('No se encontraron turnos para el DNI ingresado.');
                }
                setSearchedDni(dni);
            } else {
                setError('Por favor, ingrese un DNI.');
            }
            setIsLoading(false);
        }, 500);
    };

    return (
        <div className="container py-12">
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>Consulta de Turnos</CardTitle>
                    <CardDescription>Ingresa tu DNI para ver tus próximos turnos y tu historial.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input 
                            value={dni}
                            onChange={(e) => setDni(e.target.value)}
                            placeholder="Ingresa tu número de DNI sin puntos"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={isLoading}>
                            {isLoading ? 'Buscando...' : 'Buscar'}
                        </Button>
                    </div>

                    {error && <p className="mt-4 text-center text-destructive">{error}</p>}

                    {foundAppointments.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4">Turnos para DNI: {searchedDni}</h3>
                            <div className="space-y-3">
                                {foundAppointments.map(appt => (
                                    <div key={appt.id} className="border p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                        <div>
                                            <p className="font-bold">{new Date(appt.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} - {appt.time} hs</p>
                                            <p className="text-muted-foreground">{appt.patientName}</p>
                                        </div>
                                        <Badge variant="outline" className={`${statusStyles[appt.status]} border-none`}>
                                            {statusLabels[appt.status]}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoading && searchedDni && foundAppointments.length === 0 && !error && (
                         <p className="mt-4 text-center text-muted-foreground">No se encontraron turnos para el DNI: {searchedDni}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
