'use client';

import { useState, useMemo, useEffect } from 'react';
import { MoreHorizontal, Search, Mail, History, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ManagedProfessional } from '@/types';
import { ProfessionalDetailsDialog } from '@/components/super-admin/professional-details-dialog';
import { UpgradePlanDialog } from '@/components/super-admin/upgrade-plan-dialog';
import { ViewPaymentsDialog } from '@/components/super-admin/view-payments-dialog';
import { BlockProfessionalDialog } from '@/components/super-admin/block-professional-dialog';
import { ExtendTrialDialog } from '@/components/super-admin/extend-trial-dialog';
import { format } from 'date-fns';
import { ActivityLogDialog } from '@/components/super-admin/activity-log-dialog';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/hooks/use-toast';

export default function SuperDashboardClientesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [professionals, setProfessionals] = useState<ManagedProfessional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<ManagedProfessional | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    setIsClient(true);
    fetchProfessionals();
  }, [isUserLoading, user, router]);

  async function fetchProfessionals() {
    try {
      setLoading(true);
      setRefreshing(true);
      const query = new URLSearchParams({
        limit: '500',
      });
      
      if (searchTerm.trim()) {
        query.set('search', searchTerm);
      }

      const response = await fetchWithAuth(`/api/super-dashboard/professionals?${query}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.replace('/auth/login');
          return;
        }
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setProfessionals(data.professionals || []);
    } catch (error) {
      console.error('Error fetching professionals:', error);
      setProfessionals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isExtendTrialOpen, setIsExtendTrialOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  // Fetch cuando cambia el searchTerm
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isClient) {
        fetchProfessionals();
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProfessionals = useMemo(() => {
    return professionals;
  }, [professionals]);

  const handleOpenDialog = (setter: (isOpen: boolean) => void, professional: ManagedProfessional) => {
    setSelectedProfessional(professional);
    setter(true);
  };

  const handleUpgrade = (professionalId: string, newPlan: ManagedProfessional['plan']) => {
    setProfessionals(prev => 
      prev.map(p => p.id === professionalId ? { ...p, plan: newPlan, status: 'Activa' } : p)
    );
  };

  const handleExtendTrial = (professionalId: string, newTrialEndDate: string) => {
    setProfessionals(prev =>
      prev.map(p => p.id === professionalId ? { ...p, trialEndsAt: newTrialEndDate } : p)
    );
  };

  const handleToggleBlock = (professionalId: string) => {
    setProfessionals(prev =>
      prev.map(p => {
        if (p.id === professionalId) {
          const isBlocked = p.status === 'Bloqueada';
          // If unblocking, decide what status to go to. If trial, go to 'En prueba', otherwise 'Activa'.
          const newStatus = isBlocked ? (p.plan === 'Trial' ? 'En prueba' : 'Activa') : 'Bloqueada';
          return { ...p, status: newStatus };
        }
        return p;
      })
    );
  };

  async function handleToggleVerification(professional: ManagedProfessional) {
    try {
      setVerifyingId(professional.id);
      const nextVerified = !professional.verified;

      const response = await fetchWithAuth(
        `/api/super-dashboard/professionals/${professional.id}/verification`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: nextVerified }),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo actualizar la verificación.');
      }

      setProfessionals((prev) =>
        prev.map((p) => (p.id === professional.id ? { ...p, verified: nextVerified } : p))
      );

      toast({
        title: nextVerified ? 'Perfil verificado' : 'Verificación revocada',
        description: `${professional.name} ahora figura como ${nextVerified ? 'verificado' : 'no verificado'}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error de verificación',
        description: error instanceof Error ? error.message : 'No se pudo actualizar la verificación.',
      });
    } finally {
      setVerifyingId(null);
    }
  }

  const statusStyles: { [key in ManagedProfessional['status']]: string } = {
    Activa: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    'En prueba': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
    Vencida: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800',
    Bloqueada: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Clientes</h1>
        <p className="text-muted-foreground">
          Un total de {professionals.length} profesionales registrados.
        </p>
      </header>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between pb-2">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nombre o email..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => fetchProfessionals()}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !refreshing ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Cargando profesionales...</div>
            </div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                {searchTerm ? 'No se encontraron profesionales' : 'No hay profesionales registrados'}
              </div>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <TableHead className="hidden xl:table-cell">Uso de Turnos (mes)</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Vencimiento / Último Pago</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfessionals.map((prof) => (
                <TableRow key={prof.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prof.avatarUrl} alt="Avatar" />
                        <AvatarFallback>{prof.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className='flex flex-col'>
                        <div className="font-medium">{prof.name}</div>
                        <div className="text-xs text-muted-foreground">{prof.email}</div>
                        <div className="text-[11px]">
                          {prof.verified ? (
                            <span className="text-emerald-600 font-medium">Perfil verificado</span>
                          ) : (
                            <span className="text-muted-foreground">Perfil no verificado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={prof.plan === 'Profesional' ? 'default' : 'outline'}>{prof.plan}</Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {prof.appointmentLimit === 'unlimited' ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{prof.appointmentCount}</span>
                        <span className="text-xs text-muted-foreground">Turnos ilimitados</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Progress value={(prof.appointmentCount / prof.appointmentLimit) * 100} className="h-2" />
                        <span className="text-xs text-muted-foreground">
                          {prof.appointmentCount} de {prof.appointmentLimit} turnos
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={cn('border', statusStyles[prof.status])}>
                      {prof.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {prof.plan === 'Trial' && prof.trialEndsAt 
                      ? (isClient ? `Prueba termina ${format(new Date(prof.trialEndsAt), 'dd/MM/yy')}`: 'Prueba termina ...')
                      : prof.lastPayment.split('-').reverse().join('/')}
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
                        <DropdownMenuLabel>Acciones para {prof.name}</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsDetailsOpen, prof); }}>Ver Detalles</DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleToggleVerification(prof);
                          }}
                          disabled={verifyingId === prof.id}
                        >
                          {prof.verified ? 'Quitar verificación' : 'Aprobar verificación'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsUpgradeOpen, prof); }}>Cambiar Plan</DropdownMenuItem>
                        {prof.plan === 'Trial' && <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsExtendTrialOpen, prof); }}>Extender Prueba</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsPaymentsOpen, prof); }}>Ver Pagos</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`mailto:${prof.email}`} className="flex items-center cursor-pointer w-full">
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Enviar Email</span>
                          </Link>
                        </DropdownMenuItem>
                         <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsActivityLogOpen, prof); }}>
                            <History className="mr-2 h-4 w-4" />
                            <span>Ver Logs de Actividad</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onSelect={(e) => { e.preventDefault(); handleOpenDialog(setIsBlockOpen, prof); }}
                          className={prof.status === 'Bloqueada' ? 'text-green-600 focus:text-green-700' : 'text-destructive focus:text-destructive'}
                        >
                          {prof.status === 'Bloqueada' ? 'Desbloquear Profesional' : 'Suspender Cuenta'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <ProfessionalDetailsDialog 
        professional={selectedProfessional}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
      <UpgradePlanDialog
        professional={selectedProfessional}
        open={isUpgradeOpen}
        onOpenChange={setIsUpgradeOpen}
        onUpgrade={handleUpgrade}
      />
       <ViewPaymentsDialog
        professional={selectedProfessional}
        open={isPaymentsOpen}
        onOpenChange={setIsPaymentsOpen}
      />
       <BlockProfessionalDialog
        professional={selectedProfessional}
        open={isBlockOpen}
        onOpenChange={setIsBlockOpen}
        onConfirm={handleToggleBlock}
      />
      <ExtendTrialDialog
        professional={selectedProfessional}
        open={isExtendTrialOpen}
        onOpenChange={setIsExtendTrialOpen}
        onExtend={handleExtendTrial}
      />
      <ActivityLogDialog
        professional={selectedProfessional}
        open={isActivityLogOpen}
        onOpenChange={setIsActivityLogOpen}
      />
    </div>
  );
}
