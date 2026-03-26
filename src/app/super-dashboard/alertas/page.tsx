'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface Alert {
  id: string;
  type: string;
  endpoint: string;
  actorUid: string;
  eventCount: number;
  threshold: number;
  windowMinutes: number;
  status: 'active' | 'acknowledged' | 'resolved';
  severity: 'medium' | 'high' | 'critical';
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  notes: string;
}

type FilterStatus = 'active' | 'acknowledged' | 'resolved' | 'all';

export default function AlertasPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');
  const [noteInputId, setNoteInputId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
  }, [isUserLoading, user, router]);

  const stats = {
    active: alerts.filter((a) => a.status === 'active').length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
  };

  async function fetchAlerts() {
    try {
      setRefreshing(true);
      const query = new URLSearchParams({
        status: statusFilter === 'all' ? 'all' : statusFilter,
        limit: '100',
      });

      const response = await fetchWithAuth(`/api/super-dashboard/alerts?${query}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 403) {
          router.replace('/auth/login');
        }
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter]);

  async function updateAlertStatus(alertId: string, newStatus: string) {
    try {
      const response = await fetchWithAuth('/api/super-dashboard/alerts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          status: newStatus,
          notes: noteText,
        }),
      });

      if (!response.ok) throw new Error('Failed to update alert');

      setNoteInputId(null);
      setNoteText('');
      await fetchAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-50 border-red-200';
      case 'acknowledged':
        return 'bg-blue-50 border-blue-200';
      case 'resolved':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'acknowledged':
        return 'Reconocida';
      case 'resolved':
        return 'Resuelta';
      default:
        return status;
    }
  };

  if (isUserLoading || (loading && !refreshing)) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Alertas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Reconocidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.acknowledged}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Resueltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Alertas de Seguridad</CardTitle>
            <Button
              onClick={() => fetchAlerts()}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
              />
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as FilterStatus)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="acknowledged">Reconocidas</SelectItem>
            <SelectItem value="resolved">Resueltas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-medium">No hay alertas a mostrar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`border-2 ${getStatusColor(alert.status)}`}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center mb-1">
                          <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{getStatusLabel(alert.status)}</Badge>
                          <span className="text-xs text-gray-600">
                            {new Date(alert.createdAt).toLocaleString('es-AR')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{alert.type}</p>
                        <p className="text-xs text-gray-600 mt-1">{alert.endpoint}</p>
                      </div>
                    </div>
                  </div>

                  {/* Alert details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-white/50 p-2 rounded text-xs">
                    <div>
                      <span className="text-gray-600">UID Actor:</span>
                      <p className="text-gray-900 font-mono truncate">{alert.actorUid}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Eventos</span>
                      <p className="text-gray-900 font-semibold">
                        {alert.eventCount} / {alert.threshold}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Ventana</span>
                      <p className="text-gray-900">{alert.windowMinutes} min</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Estado</span>
                      <p className="text-gray-900 capitalize">{alert.status}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {alert.notes && (
                    <div className="bg-blue-50 border border-blue-200 p-2 rounded text-xs">
                      <p className="text-blue-900">
                        <strong>Nota:</strong> {alert.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {alert.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                        >
                          Reconocer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAlertStatus(alert.id, 'resolved')}
                        >
                          Resolver
                        </Button>
                      </>
                    )}
                    {alert.status === 'acknowledged' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAlertStatus(alert.id, 'resolved')}
                      >
                        Resolver
                      </Button>
                    )}
                    {noteInputId === alert.id ? (
                      <div className="flex gap-2 flex-1 min-w-full">
                        <Input
                          placeholder="Agregar nota..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => updateAlertStatus(alert.id, alert.status)}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setNoteInputId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNoteInputId(alert.id);
                          setNoteText(alert.notes || '');
                        }}
                      >
                        📝 Nota
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
