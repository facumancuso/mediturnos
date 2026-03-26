'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

type SecurityAuditLog = {
  id: string;
  type: string;
  endpoint: string;
  method: string;
  actorUid: string;
  actorEmail: string;
  requestedProfessionalId: string;
  reason: string;
  ip: string;
  userAgent: string;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function SuperDashboardSecurityPage() {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [endpointFilter, setEndpointFilter] = useState('');
  const [actorUidFilter, setActorUidFilter] = useState('');
  const [sinceHoursFilter, setSinceHoursFilter] = useState('24');

  const fetchLogs = async () => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (endpointFilter.trim()) params.set('endpoint', endpointFilter.trim());
    if (actorUidFilter.trim()) params.set('actorUid', actorUidFilter.trim());
    if (sinceHoursFilter.trim()) params.set('sinceHours', sinceHoursFilter.trim());

    const response = await fetchWithAuth(`/api/super-dashboard/security-logs?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('No se pudieron cargar los logs de seguridad.');
    }

    return (await response.json()) as SecurityAuditLog[];
  };

  useEffect(() => {
    let cancelled = false;

    async function loadLogsEffect() {
      try {
        setIsLoading(true);
        const data = await fetchLogs();
        if (!cancelled) {
          setLogs(data);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadLogsEffect();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyFilters = async () => {
    try {
      setIsLoading(true);
      const data = await fetchLogs();
      setLogs(data);
    } catch (error) {
      console.error(error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!logs.length) return;

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = [
      'createdAt',
      'type',
      'method',
      'endpoint',
      'actorUid',
      'actorEmail',
      'requestedProfessionalId',
      'ip',
      'userAgent',
      'reason',
    ];

    const rows = logs.map((log) => [
      log.createdAt || '',
      log.type || '',
      log.method || '',
      log.endpoint || '',
      log.actorUid || '',
      log.actorEmail || '',
      log.requestedProfessionalId || '',
      log.ip || '',
      log.userAgent || '',
      log.reason || '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const forbidden = logs.filter((log) => log.type === 'forbidden_access').length;
    const unauthorized = logs.filter((log) => log.type === 'unauthorized_access').length;
    return {
      total: logs.length,
      forbidden,
      unauthorized,
    };
  }, [logs]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Seguridad</h1>
        <p className="text-muted-foreground">Auditoría de intentos de acceso no autorizado en APIs sensibles.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Eventos auditados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.total}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Forbidden (403)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.forbidden}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.unauthorized}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros rápidos</CardTitle>
          <CardDescription>Refina resultados y exporta la vista actual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="forbidden_access">forbidden_access</SelectItem>
              <SelectItem value="unauthorized_access">unauthorized_access</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Endpoint (ej: /api/dashboard/patients)"
            value={endpointFilter}
            onChange={(event) => setEndpointFilter(event.target.value)}
          />

          <Input
            placeholder="UID actor"
            value={actorUidFilter}
            onChange={(event) => setActorUidFilter(event.target.value)}
          />

          <Input
            placeholder="Horas hacia atrás"
            value={sinceHoursFilter}
            onChange={(event) => setSinceHoursFilter(event.target.value)}
          />

          <div className="flex gap-2">
            <Button className="w-full" onClick={handleApplyFilters} disabled={isLoading}>
              Aplicar
            </Button>
            <Button variant="outline" onClick={handleExportCsv} disabled={isLoading || logs.length === 0}>
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Eventos recientes
          </CardTitle>
          <CardDescription>Últimos intentos registrados en `security_audit_logs`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            [...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={log.type === 'forbidden_access' ? 'destructive' : 'secondary'}>
                    {log.type}
                  </Badge>
                  <span className="text-sm font-medium">
                    {log.method} {log.endpoint}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{log.reason || 'Sin detalle.'}</p>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                  <span>UID actor: {log.actorUid || '-'}</span>
                  <span>Email actor: {log.actorEmail || '-'}</span>
                  <span>ProfessionalId solicitado: {log.requestedProfessionalId || '-'}</span>
                  <span>IP: {log.ip || '-'}</span>
                  <span className="md:col-span-2">User-Agent: {log.userAgent || '-'}</span>
                  <span>Fecha: {formatDate(log.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No hay eventos de seguridad registrados todavía.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
