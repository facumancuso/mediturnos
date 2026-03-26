'use client';

import { useState, useMemo, useEffect } from 'react';
import { isSameDay, format } from 'date-fns';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { allAppointments } from '@/lib/mock-data';
import type { Appointment } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ReportsPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredAppointments = useMemo(() => {
    if (!date) return [];
    return allAppointments.filter((appt) =>
      isSameDay(appt.date, date)
    );
  }, [date]);
  
  const totalRevenue = useMemo(() => {
    return filteredAppointments
        .filter(a => a.status === 'completed' && a.revenue)
        .reduce((sum, appt) => sum + appt.revenue!, 0);
  }, [filteredAppointments]);

  const [formattedTotalRevenue, setFormattedTotalRevenue] = useState<string | null>(null);

  useEffect(() => {
    // Format on client to avoid hydration mismatch.
    setFormattedTotalRevenue(totalRevenue.toLocaleString('es-AR'));
  }, [totalRevenue]);

  const totalAppointments = filteredAppointments.length;
  const noShowAppointments = filteredAppointments.filter(a => a.status === 'no_show').length;
  const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;
  
  const statusDistribution = useMemo(() => {
    const counts = filteredAppointments.reduce((acc, appt) => {
        acc[appt.status] = (acc[appt.status] || 0) + 1;
        return acc;
    }, {} as Record<Appointment['status'], number>);
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredAppointments]);

  const typeDistribution = useMemo(() => {
     const counts = filteredAppointments.reduce((acc, appt) => {
        const typeName = appt.type === 'checkup' ? 'Control' : appt.type === 'first_time' ? 'Primera Vez' : 'Urgencia';
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredAppointments]);


  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes y Analíticas</h1>
          <p className="text-muted-foreground">
            Analiza el rendimiento de tu consultorio.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={'outline'}
                    className={cn(
                    'w-[300px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {isClient && date ? (
                        format(date, 'LLL dd, y')
                    ) : (
                        <span>Elige una fecha</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                {isClient ? (
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                    />
                ) : (
                    <div className="p-3"><Skeleton className="h-[298px] w-[545px] rounded-md" /></div>
                )}
                </PopoverContent>
            </Popover>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </header>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formattedTotalRevenue ?? '...'}</div>
              <p className="text-xs text-muted-foreground">En el período seleccionado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total de Turnos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAppointments}</div>
              <p className="text-xs text-muted-foreground">En el período seleccionado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tasa de Ausentismo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{noShowRate.toFixed(1)}%</div>
               <p className="text-xs text-muted-foreground">{noShowAppointments} ausencias en total</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tasa de Ocupación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-muted-foreground">Estimación basada en horarios</p>
            </CardContent>
          </Card>
      </div>

       <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Turnos por Estado</CardTitle>
                    <CardDescription>Distribución de los estados de los turnos en el período seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statusDistribution}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`}/>
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Tipos de Consulta</CardTitle>
                    <CardDescription>Distribución de los tipos de consulta en el período.</CardDescription>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={typeDistribution} cx="50%" cy="50%" labelLine={false} outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {typeDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
       </div>
    </div>
  );
}
