'use client';

import { MoreHorizontal, PlusCircle, Search, Star } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { AddAppointmentDialog } from '@/components/add-appointment-dialog';
import { PatientDetailsDialog } from '@/components/patient-details-dialog';
import type { Patient } from '@/types';
import { AddPatientDialog } from '@/components/add-patient-dialog';
import { EditPatientDialog } from '@/components/edit-patient-dialog';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithAuth } from '@/lib/fetch-with-auth';


export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [selectedPatientIdForAppt, setSelectedPatientIdForAppt] = useState<string | undefined>(undefined);
  
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedPatientForDetails, setSelectedPatientForDetails] = useState<Patient | null>(null);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [selectedPatientForEdit, setSelectedPatientForEdit] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useUser();

  useEffect(() => {
    const professionalId = user?.uid;
    if (!professionalId) {
      setPatients([]);
      return;
    }

    let cancelled = false;

    async function loadPatients() {
      try {
        setIsLoading(true);
        const response = await fetchWithAuth(`/api/dashboard/patients?professionalId=${professionalId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los pacientes.');
        }

        const data = (await response.json()) as Patient[];
        if (!cancelled) {
          setPatients(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPatients([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPatients();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const filteredPatients = useMemo(() => {
    const patientList = patients;
    if (!searchTerm) return patientList;
    return patientList.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.dni.replace(/\./g, '').includes(searchTerm.replace(/\./g, ''))
    );
  }, [searchTerm, patients]);

  const openAppointmentDialog = (patientId?: string) => {
    setSelectedPatientIdForAppt(patientId);
    setIsAppointmentDialogOpen(true);
  };
  
  const openDetailsDialog = (patient: Patient) => {
    setSelectedPatientForDetails(patient);
    setIsDetailsDialogOpen(true);
  };

  const handlePatientAdded = (newPatient: Patient) => {
    setPatients((prev) => {
      const withoutDuplicated = prev.filter((patient) => patient.id !== newPatient.id);
      return [newPatient, ...withoutDuplicated];
    });
  };

  const handlePatientUpdated = (updated: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const openEditDialog = (patient: Patient) => {
    setSelectedPatientForEdit(patient);
    setIsEditPatientOpen(true);
  };

  return (
    <>
      <AddAppointmentDialog
        open={isAppointmentDialogOpen}
        onOpenChange={setIsAppointmentDialogOpen}
        defaultPatientId={selectedPatientIdForAppt}
      />
      <PatientDetailsDialog
        patient={selectedPatientForDetails}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onUpdated={handlePatientUpdated}
      />
      <AddPatientDialog
        open={isAddPatientOpen}
        onOpenChange={setIsAddPatientOpen}
        onPatientAdded={handlePatientAdded}
      />
      <EditPatientDialog
        patient={selectedPatientForEdit}
        open={isEditPatientOpen}
        onOpenChange={setIsEditPatientOpen}
        onPatientUpdated={handlePatientUpdated}
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Gestiona la información de tus pacientes.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setIsAddPatientOpen(true)} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar Paciente</span>
                  <span className="sm:hidden">Agregar</span>
              </Button>
               <Button onClick={() => openAppointmentDialog()} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Agendar Turno</span>
                  <span className="sm:hidden">Turno</span>
              </Button>
            </div>
        </div>

        <Card>
            <CardHeader>
              <CardTitle>Listado de Pacientes</CardTitle>
              <CardDescription>
                  {isLoading ? 'Cargando pacientes...' : `Mostrando ${filteredPatients.length} de ${patients.length} pacientes registrados.`}
              </CardDescription>
              <div className="relative pt-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o DNI..." 
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
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">DNI</TableHead>
                    <TableHead className="hidden md:table-cell">Obra Social</TableHead>
                    <TableHead className="hidden lg:table-cell">Última Visita</TableHead>
                    <TableHead className="hidden lg:table-cell">Visitas</TableHead>
                    <TableHead className="hidden lg:table-cell">Inasistencias</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <TableRow key={patient.id} onDoubleClick={() => openDetailsDialog(patient)} className="cursor-pointer">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={patient.avatarUrl} alt="Avatar" />
                              <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{patient.name}</span>
                              {patient.totalVisits > 10 && <Badge variant="secondary" className="w-fit mt-1"><Star className="mr-1 h-3 w-3 text-yellow-500 fill-yellow-500"/> Frecuente</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{patient.dni}</TableCell>
                        <TableCell className="hidden md:table-cell">
                            <Badge variant="outline">{patient.insurance}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="hidden lg:table-cell">{patient.totalVisits}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className={patient.missedAppointments > 2 ? 'text-destructive font-bold' : ''}>
                            {patient.missedAppointments}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir menú</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDetailsDialog(patient); }}>
                                Ver Ficha Completa
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openAppointmentDialog(patient.id); }}>
                                Agendar Turno
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditDialog(patient); }}>
                                Editar Paciente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                         <TableCell colSpan={7} className="h-24 text-center">
                             No se encontraron pacientes.
                         </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </div>
    </>
  );
}
