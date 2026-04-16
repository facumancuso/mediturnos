'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/firebase';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Copy,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  SendHorizonal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PaymentStatusCode = 'pending' | 'submitted' | 'paid' | 'overdue';

type Payment = {
  id: string;
  period: string;
  dueDate: string;
  amount: number;
  status: string;
  statusCode: PaymentStatusCode;
  method: string;
  reference: string;
};

const BANK_DETAILS = {
  bank: 'Banco Nación',
  accountHolder: 'MediTurnos S.A.',
  alias: 'mediturnos.cobros',
  cbu: '0110123412341234123412',
  cuit: '30-71234567-8',
};

function statusBadgeVariant(statusCode: PaymentStatusCode) {
  if (statusCode === 'paid') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (statusCode === 'submitted') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (statusCode === 'overdue') return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-amber-100 text-amber-800 border-amber-300';
}

function statusIcon(statusCode: PaymentStatusCode) {
  if (statusCode === 'paid') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (statusCode === 'submitted') return <Clock3 className="h-4 w-4 text-blue-600" />;
  if (statusCode === 'overdue') return <AlertTriangle className="h-4 w-4 text-red-600" />;
  return <Clock3 className="h-4 w-4 text-amber-600" />;
}

function formatAmount(value: number) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function formatPeriod(period: string | null): string {
  if (!period) return '';
  try {
    return format(parseISO(`${period}-01`), 'MMMM yyyy', { locale: es });
  } catch {
    return period;
  }
}

export default function PagosPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [startPeriod, setStartPeriod] = useState<string | null>(null);
  const [lastVisiblePeriod, setLastVisiblePeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMethodByPayment, setSelectedMethodByPayment] = useState<Record<string, string>>({});
  const [referenceByPayment, setReferenceByPayment] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    void fetchPayments();
  }, [isUserLoading, user, router]);

  async function fetchPayments() {
    try {
      setRefreshing(true);
      const response = await fetchWithAuth('/api/dashboard/payments', { cache: 'no-store' });

      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/auth/login');
          return;
        }
        throw new Error('No se pudo cargar el historial de pagos.');
      }

      const data = (await response.json()) as { payments?: Payment[]; startPeriod?: string; lastVisiblePeriod?: string };
      setPayments(data.payments || []);
      setStartPeriod(data.startPeriod || null);
      setLastVisiblePeriod(data.lastVisiblePeriod || null);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los pagos.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const summary = useMemo(() => {
    const overdue = payments.filter((item) => item.statusCode === 'overdue');
    const pending = payments.filter((item) => item.statusCode === 'pending');
    const submitted = payments.filter((item) => item.statusCode === 'submitted');
    const paid = payments.filter((item) => item.statusCode === 'paid');

    return {
      totalAmount: payments.reduce((acc, item) => acc + item.amount, 0),
      totalMonths: payments.length,
      unpaidAmount: [...overdue, ...pending].reduce((acc, item) => acc + item.amount, 0),
      unpaidCount: overdue.length + pending.length,
      overdueCount: overdue.length,
      submittedAmount: submitted.reduce((acc, item) => acc + item.amount, 0),
      submittedCount: submitted.length,
      paidAmount: paid.reduce((acc, item) => acc + item.amount, 0),
      paidCount: paid.length,
    };
  }, [payments]);

  function copyValue(label: string, value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        toast({ title: `${label} copiado`, description: value });
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Error', description: `No se pudo copiar ${label}.` });
      });
  }

  async function handleSubmitPayment(payment: Payment) {
    const paymentMethod = selectedMethodByPayment[payment.id] || '';
    const paymentReference = referenceByPayment[payment.id] || '';

    if (!paymentMethod) {
      toast({
        variant: 'destructive',
        title: 'Falta forma de pago',
        description: 'Selecciona transferencia o efectivo.',
      });
      return;
    }

    try {
      setUpdatingId(payment.id);

      const response = await fetchWithAuth(`/api/dashboard/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          paymentMethod,
          paymentReference,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'No se pudo avisar el pago.');
      }

      toast({
        title: 'Pago enviado',
        description: 'Tu aviso fue enviado para revisión de administración.',
      });

      setExpandedId(null);
      await fetchPayments();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error enviando pago',
        description: error instanceof Error ? error.message : 'No se pudo enviar el pago.',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading && !refreshing) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cargando pagos...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodText =
    startPeriod && lastVisiblePeriod
      ? `Período: ${formatPeriod(startPeriod)} — ${formatPeriod(lastVisiblePeriod)}`
      : 'Monitorea el estado de cada mes y avisá tus pagos.';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground capitalize">{periodText}</p>
        </div>
        <Button onClick={() => void fetchPayments()} disabled={refreshing} variant="outline" size="icon" className="shrink-0">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">Total período</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{formatAmount(summary.totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{summary.totalMonths} mes{summary.totalMonths !== 1 ? 'es' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">Pendiente / Vencido</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={cn('text-2xl font-bold', summary.overdueCount > 0 ? 'text-red-600' : 'text-amber-600')}>
              {formatAmount(summary.unpaidAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.unpaidCount} mes{summary.unpaidCount !== 1 ? 'es' : ''}
              {summary.overdueCount > 0 ? ` · ${summary.overdueCount} vencido${summary.overdueCount !== 1 ? 's' : ''}` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">Pago enviado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-blue-600">{formatAmount(summary.submittedAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{summary.submittedCount} mes{summary.submittedCount !== 1 ? 'es' : ''} en revisión</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground font-medium">Pago recibido</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-emerald-600">{formatAmount(summary.paidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.paidCount} mes{summary.paidCount !== 1 ? 'es' : ''} confirmado{summary.paidCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos bancarios para transferencia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Banco</p>
            <p className="font-medium">{BANK_DETAILS.bank}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Titular</p>
            <p className="font-medium">{BANK_DETAILS.accountHolder}</p>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Alias</p>
                <p className="font-medium break-all">{BANK_DETAILS.alias}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => copyValue('Alias', BANK_DETAILS.alias)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-md border p-3 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">CBU</p>
                <p className="font-medium break-all">{BANK_DETAILS.cbu}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => copyValue('CBU', BANK_DETAILS.cbu)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-md border p-3 sm:col-span-2 xl:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">CUIT</p>
                <p className="font-medium break-all">{BANK_DETAILS.cuit}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => copyValue('CUIT', BANK_DETAILS.cuit)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recibos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay recibos generados todavía.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {payments.map((payment) => {
                  const canSubmit = payment.statusCode === 'pending' || payment.statusCode === 'overdue';
                  const isExpanded = expandedId === payment.id;
                  const isSubmitting = updatingId === payment.id;
                  const monthDate = payment.period ? new Date(`${payment.period}-01T12:00:00.000Z`) : new Date();

                  return (
                    <div key={payment.id} className="rounded-lg border p-3 space-y-3">
                      <button
                        type="button"
                        className={cn('w-full text-left', canSubmit && 'cursor-pointer')}
                        onClick={() => {
                          if (canSubmit) {
                            setExpandedId(isExpanded ? null : payment.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold capitalize">{format(monthDate, 'MMMM yyyy', { locale: es })}</p>
                            <p className="text-xs text-muted-foreground">Vence {format(new Date(payment.dueDate), 'dd/MM/yyyy')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{formatAmount(payment.amount)}</span>
                            {canSubmit && (isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {statusIcon(payment.statusCode)}
                          <Badge variant="outline" className={statusBadgeVariant(payment.statusCode)}>
                            {payment.status}
                          </Badge>
                        </div>
                      </button>

                      {canSubmit && isExpanded && (
                        <div className="space-y-2 border-t pt-3">
                          <Select
                            value={selectedMethodByPayment[payment.id] || ''}
                            onValueChange={(value) =>
                              setSelectedMethodByPayment((current) => ({ ...current, [payment.id]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Forma de pago" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Transferencia bancaria">Transferencia bancaria</SelectItem>
                              <SelectItem value="Efectivo">Efectivo</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Referencia (opcional)"
                            value={referenceByPayment[payment.id] || ''}
                            onChange={(event) =>
                              setReferenceByPayment((current) => ({ ...current, [payment.id]: event.target.value }))
                            }
                          />
                          <Button
                            className="w-full"
                            onClick={() => void handleSubmitPayment(payment)}
                            disabled={isSubmitting || !selectedMethodByPayment[payment.id]}
                          >
                            <SendHorizonal className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Enviando...' : 'Avisar pago'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Forma y referencia</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const monthDate = payment.period ? new Date(`${payment.period}-01T12:00:00.000Z`) : new Date();
                      const canSubmit = payment.statusCode === 'pending' || payment.statusCode === 'overdue';
                      const isSubmitting = updatingId === payment.id;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium capitalize">{format(monthDate, 'MMMM yyyy', { locale: es })}</TableCell>
                          <TableCell>{format(new Date(payment.dueDate), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right font-semibold">{formatAmount(payment.amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusIcon(payment.statusCode)}
                              <Badge variant="outline" className={statusBadgeVariant(payment.statusCode)}>
                                {payment.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[280px]">
                            {canSubmit ? (
                              <div className="space-y-2">
                                <Select
                                  value={selectedMethodByPayment[payment.id] || ''}
                                  onValueChange={(value) =>
                                    setSelectedMethodByPayment((current) => ({ ...current, [payment.id]: value }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Forma de pago" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Transferencia bancaria">Transferencia bancaria</SelectItem>
                                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Referencia (opcional)"
                                  value={referenceByPayment[payment.id] || ''}
                                  onChange={(event) =>
                                    setReferenceByPayment((current) => ({ ...current, [payment.id]: event.target.value }))
                                  }
                                />
                              </div>
                            ) : (
                              <div className="text-sm">
                                <p>{payment.method || '-'}</p>
                                <p className="text-muted-foreground">{payment.reference || 'Sin referencia'}</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canSubmit ? (
                              <Button
                                size="sm"
                                onClick={() => void handleSubmitPayment(payment)}
                                disabled={isSubmitting || !selectedMethodByPayment[payment.id]}
                              >
                                <SendHorizonal className="mr-2 h-4 w-4" />
                                {isSubmitting ? 'Enviando...' : 'Avisar pago'}
                              </Button>
                            ) : payment.statusCode === 'submitted' ? (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                Pago enviado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                                Pago recibido
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
