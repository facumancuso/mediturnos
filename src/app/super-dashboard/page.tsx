'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockManagedProfessionals, mockPayments } from '@/lib/mock-data';
import { DollarSign, Users, UserPlus, TrendingDown, CreditCard, UserCheck, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Calculate metrics
const totalProfessionals = mockManagedProfessionals.length;
const mrr = 3490; // mock
const newSignups = 5; // mock
const churnRate = 1.2; // mock

const revenueData = [
    { name: 'Ene', mrr: 400 },
    { name: 'Feb', mrr: 300 },
    { name: 'Mar', mrr: 500 },
    { name: 'Abr', mrr: 780 },
    { name: 'May', mrr: 1890 },
    { name: 'Jun', mrr: 2390 },
    { name: 'Jul', mrr: 3490 },
];

const failedPayments = mockManagedProfessionals.filter(p => p.status === 'Vencida' || p.status === 'Bloqueada');
const pendingApprovalsCount = 2; // mock
const supportTicketsCount = 4; // mock


export default function SuperAdminDashboardPage() {
    const [formattedMrr, setFormattedMrr] = useState<string | null>(null);

    useEffect(() => {
        // Format on client to avoid hydration mismatch.
        setFormattedMrr(mrr.toLocaleString());
    }, []);

    return (
        <div className="flex flex-col gap-6">
             <header>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Global</h1>
                <p className="text-muted-foreground">
                    Una vista general del estado de la plataforma en tiempo real.
                </p>
            </header>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Profesionales</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProfessionals}</div>
                        <p className="text-xs text-muted-foreground">+3 vs el mes pasado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingreso Mensual (MRR)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${formattedMrr ?? '...'}</div>
                        <p className="text-xs text-muted-foreground">+15.2% vs el mes pasado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nuevos Registros (7d)</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{newSignups}</div>
                        <p className="text-xs text-muted-foreground">-5% vs la semana pasada</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Churn</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{churnRate}%</div>
                        <p className="text-xs text-muted-foreground">+0.2% vs el mes pasado</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Crecimiento de Ingresos</CardTitle>
                        <CardDescription>MRR de los últimos 7 meses.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={revenueData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))'}}/>
                                <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                     <CardHeader>
                        <CardTitle>Alertas y Acciones Rápidas</CardTitle>
                        <CardDescription>Items que requieren tu atención.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className='flex items-center gap-3'>
                                <CreditCard className="h-5 w-5 text-destructive" />
                                <span className="font-medium">Pagos fallidos</span>
                            </div>
                            <Button asChild variant="secondary" size="sm">
                                <Link href="/super-dashboard/clientes">
                                    Revisar <Badge className="ml-2 bg-destructive">{failedPayments.length}</Badge>
                                </Link>
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className='flex items-center gap-3'>
                                <UserCheck className="h-5 w-5 text-yellow-500" />
                                <span className="font-medium">Perfiles por aprobar</span>
                            </div>
                            <Button asChild variant="secondary" size="sm">
                                <Link href="#">
                                    Ver <Badge className="ml-2 bg-yellow-500">{pendingApprovalsCount}</Badge>
                                </Link>
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                             <div className='flex items-center gap-3'>
                                <LifeBuoy className="h-5 w-5 text-blue-500" />
                                <span className="font-medium">Tickets de soporte</span>
                            </div>
                           <Button asChild variant="secondary" size="sm">
                                <Link href="#">
                                    Gestionar <Badge className="ml-2 bg-blue-500">{supportTicketsCount}</Badge>
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
