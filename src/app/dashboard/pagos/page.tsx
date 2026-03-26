'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

type Payment = {
  id: string;
  date: string;
  amount: number;
  status: 'Pagado' | 'Pendiente' | 'Fallido';
  plan: string;
  description: string;
  reference: string;
  method: string;
  invoiceNumber: string;
};

export default function PagosPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    fetchPayments();
  }, [isUserLoading, user, router]);

  async function fetchPayments() {
    try {
      setRefreshing(true);
      const response = await fetchWithAuth('/api/dashboard/payments', {
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/auth/login');
          return;
        }
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      setPayments(data.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const stats = {
    total: payments.reduce((sum, p) => sum + p.amount, 0),
    pagados: payments
      .filter((p) => p.status === 'Pagado')
      .reduce((sum, p) => sum + p.amount, 0),
    pendientes: payments
      .filter((p) => p.status === 'Pendiente')
      .reduce((sum, p) => sum + p.amount, 0),
    count: payments.length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pagado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Fallido':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pagado':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'Pendiente':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const handleExportCSV = () => {
    if (payments.length === 0) return;

    const headers = ['Fecha', 'Número Factura', 'Plan', 'Monto', 'Método', 'Estado'];
    const rows = payments.map((p) => [
      format(new Date(p.date), 'dd/MM/yyyy HH:mm'),
      p.invoiceNumber,
      p.plan,
      p.amount.toFixed(2),
      p.method,
      p.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pagos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };
  if (loading && !refreshing) {
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
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Mis Pagos</h1>
        <p className="text-muted-foreground">
          Gestiona y monitorea todos tus pagos con la plataforma
        </p>
      </header>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.pagados.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${stats.pendientes.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${stats.total.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historial de Pagos</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleExportCSV}
                disabled={payments.length === 0}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                onClick={() => fetchPayments()}
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
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">No hay pagos registrados</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número de Factura</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {format(new Date(payment.date), 'dd/MM/yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(payment.date), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {payment.invoiceNumber}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${payment.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{payment.method}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <Badge
                            variant="outline"
                            className={getStatusColor(payment.status)}
                          >
                            {payment.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Future: implement download functionality
                            console.log('Download', payment.invoiceNumber);
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>💡 Nota:</strong> Todos tus pagos se registran automáticamente cuando confirmas
            tu suscripción. Si tienes problemas con un pago o preguntas sobre tu facturación,
            contacta con soporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
