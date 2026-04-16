'use client'

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { mockProfessionals } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

// Derive initial lists from mock data
const initialSpecialties = [...new Set(mockProfessionals.map(p => p.specialty))];
const initialInsurances = [...new Set(mockProfessionals.flatMap(p => p.insurances))];

export default function PlansPage() {
    const { toast } = useToast();
    const [specialties, setSpecialties] = React.useState(initialSpecialties);
    const [insurances, setInsurances] = React.useState(initialInsurances);
    const [newSpecialty, setNewSpecialty] = React.useState('');
    const [newInsurance, setNewInsurance] = React.useState('');

    const handleSave = (planName: string) => {
        toast({
            title: "Plan guardado",
            description: `La configuración del plan ${planName} ha sido actualizada.`,
        });
    }

    const handleAddSpecialty = () => {
        if (newSpecialty && !specialties.includes(newSpecialty)) {
            setSpecialties(prev => [...prev, newSpecialty]);
            setNewSpecialty('');
            toast({ title: 'Especialidad agregada' });
        }
    }

    const handleAddInsurance = () => {
        if (newInsurance && !insurances.includes(newInsurance)) {
            setInsurances(prev => [...prev, newInsurance]);
            setNewInsurance('');
            toast({ title: 'Obra Social agregada' });
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Planes y Configuración</h1>
                <p className="text-muted-foreground">
                    Ajusta los precios, limitaciones y configuraciones globales de la plataforma.
                </p>
            </div>
            
            <h2 className="text-2xl font-semibold tracking-tight">Planes de Suscripción</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Plan Básico */}
                <Card>
                    <CardHeader>
                        <CardTitle>Plan Básico</CardTitle>
                        <CardDescription>Para profesionales que recién comienzan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="price-basico">Precio (USD) / mes</Label>
                            <Input id="price-basico" type="number" defaultValue="20" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="turnos-basico">Límite de turnos / mes</Label>
                            <Input id="turnos-basico" type="number" defaultValue="100" />
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-medium">Funcionalidades Incluidas</h4>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-basico-1" defaultChecked disabled />
                                <Label htmlFor="feat-basico-1" className="text-muted-foreground">Calendario y Turnos</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-basico-2" defaultChecked disabled />
                                <Label htmlFor="feat-basico-2" className="text-muted-foreground">Gestión de pacientes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-basico-3" disabled />
                                <Label htmlFor="feat-basico-3" className="text-muted-foreground">Perfil público en directorio</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-basico-4" disabled />
                                <Label htmlFor="feat-basico-4" className="text-muted-foreground">Integración con Calendario de Google</Label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => handleSave('Básico')}>Guardar Cambios</Button>
                    </CardFooter>
                </Card>

                {/* Plan Profesional */}
                <Card className="border-primary">
                     <CardHeader>
                        <CardTitle>Plan Profesional</CardTitle>
                        <CardDescription>La solución completa para consultorios establecidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="price-profesional">Precio (USD) / mes</Label>
                            <Input id="price-profesional" type="number" defaultValue="40" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="turnos-profesional">Límite de turnos / mes</Label>
                            <Input id="turnos-profesional" defaultValue="Ilimitados" disabled />
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-medium">Funcionalidades Incluidas</h4>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-profesional-1" defaultChecked disabled />
                                <Label htmlFor="feat-profesional-1" className="text-muted-foreground">Todo lo del plan Básico</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-profesional-2" defaultChecked />
                                <Label htmlFor="feat-profesional-2">Perfil público en directorio</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-profesional-3" defaultChecked />
                                <Label htmlFor="feat-profesional-3">Integración con Calendario de Google</Label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => handleSave('Profesional')}>Guardar Cambios</Button>
                    </CardFooter>
                </Card>

                {/* Plan Clínica */}
                <Card>
                     <CardHeader>
                        <CardTitle>Plan Clínica</CardTitle>
                        <CardDescription>Para equipos y clínicas con múltiples profesionales.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="price-clinica">Precio (USD) / mes</Label>
                            <Input id="price-clinica" type="number" defaultValue="90" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="turnos-clinica">Límite de turnos / mes</Label>
                            <Input id="turnos-clinica" defaultValue="Ilimitados" disabled />
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-medium">Funcionalidades Incluidas</h4>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="feat-clinica-1" defaultChecked disabled />
                                <Label htmlFor="feat-clinica-1" className="text-muted-foreground">Todo lo del plan Profesional</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-clinica-2" defaultChecked />
                                <Label htmlFor="feat-clinica-2">Múltiples profesionales</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-clinica-3" defaultChecked />
                                <Label htmlFor="feat-clinica-3">Panel de administración</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="feat-clinica-4" defaultChecked />
                                <Label htmlFor="feat-clinica-4">Soporte prioritario</Label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => handleSave('Clínica')}>Guardar Cambios</Button>
                    </CardFooter>
                </Card>
            </div>

            <Separator className="my-4" />

            <h2 className="text-2xl font-semibold tracking-tight">Configuración Global</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Entidades de la Plataforma</CardTitle>
                        <CardDescription>Administra las especialidades y obras sociales disponibles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Especialidades */}
                        <div>
                            <Label className="text-base font-medium">Especialidades</Label>
                            <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-md min-h-[40px]">
                                {specialties.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Input 
                                    placeholder="Nueva especialidad..." 
                                    value={newSpecialty}
                                    onChange={(e) => setNewSpecialty(e.target.value)}
                                />
                                <Button onClick={handleAddSpecialty}>Agregar</Button>
                            </div>
                        </div>
                        {/* Obras Sociales */}
                         <div>
                            <Label className="text-base font-medium">Obras Sociales</Label>
                            <div className="flex flex-wrap gap-2 mt-2 p-3 border rounded-md min-h-[40px]">
                                {insurances.map(i => <Badge key={i} variant="secondary">{i}</Badge>)}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Input 
                                    placeholder="Nueva obra social..." 
                                    value={newInsurance}
                                    onChange={(e) => setNewInsurance(e.target.value)}
                                />
                                <Button onClick={handleAddInsurance}>Agregar</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Cuenta</CardTitle>
                        <CardDescription>Ajustes generales para nuevas cuentas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="trial-duration">Duración del Trial (días)</Label>
                            <Input id="trial-duration" type="number" defaultValue="14" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="msg-welcome-default">Mensaje de Bienvenida por Defecto</Label>
                            <Textarea 
                                id="msg-welcome-default" 
                                placeholder="Este será el mensaje de bienvenida para nuevos profesionales."
                                defaultValue="¡Hola! Soy tu asistente virtual de MediTurnos. Para empezar, ¿por qué no configuras tus horarios? ¡Estoy aquí para ayudarte a agendar tu primer turno!"
                                className="min-h-[120px]"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={() => toast({ title: "Configuración global guardada." })}>Guardar Configuración</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
