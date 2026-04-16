'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { ManagedProfessional } from '@/types';

type ViewPaymentsDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AdminPayment = {
  id: string;
  period: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  status: 'pending' | 'submitted' | 'paid' | 'overdue';
  receipt?: { fileName: string; dataUrl: string } | null;
};

function statusLabel(status: AdminPayment['status']) {
  if (status === 'paid') return 'Pago recibido';
  if (status === 'submitted') return 'Pago enviado';
  if (status === 'overdue') return 'Vencido';
  return 'Falta pagar';
}

function statusClass(status: AdminPayment['status']) {
  if (status === 'paid') return 'bg-green-100 text-green-800';
  if (status === 'submitted') return 'bg-blue-100 text-blue-800';
  if (status === 'overdue') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export function ViewPaymentsDialog({ professional, open, onOpenChange }: ViewPaymentsDialogProps) {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !professional) return;

    let cancelled = false;

    async function loadPayments() {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/super-dashboard/payments?professionalId=${professional.id}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('No se pudieron cargar los pagos.');
        }

        const data = (await response.json()) as { payments?: AdminPayment[] };
        if (!cancelled) {
          setPayments(data.payments || []);
        }
      } catch {
        if (!cancelled) {
          setPayments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPayments();

    return () => {
      cancelled = true;
    };
  }, [open, professional?.id]);

  async function handleMarkAsPaid(paymentId: string) {
    try {
      setUpdatingId(paymentId);
      const response = await fetchWithAuth(`/api/super-dashboard/payments/${paymentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });

      if (!response.ok) {
        throw new Error('No se pudo confirmar el pago.');
      }

      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId ? { ...payment, status: 'paid' } : payment
        )
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historial de Pagos</DialogTitle>
          <DialogDescription>
            Viendo los pagos realizados por {professional.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Forma de pago</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && payments.length > 0 ? (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.period}</TableCell>
                        <TableCell>${payment.amount.toFixed(2)}</TableCell>
                        <TableCell>{payment.paymentMethod || '-'}</TableCell>
                        <TableCell>{payment.paymentReference || '-'}</TableCell>
                        <TableCell>
                          {payment.receipt?.dataUrl ? (
                            <a
                              href={payment.receipt.dataUrl}
                              download={payment.receipt.fileName}
                              className="text-primary hover:underline"
                            >
                              {payment.receipt.fileName}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin comprobante</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(payment.status)}>
                            {statusLabel(payment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.status === 'submitted' ? (
                            <Button
                              size="sm"
                              onClick={() => void handleMarkAsPaid(payment.id)}
                              disabled={updatingId === payment.id}
                            >
                              {updatingId === payment.id ? 'Confirmando...' : 'Confirmar pago'}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {loading ? 'Cargando pagos...' : 'No se encontraron pagos.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
