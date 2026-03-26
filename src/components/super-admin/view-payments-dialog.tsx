'use client';
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
import type { ManagedProfessional, Payment } from '@/types';
import { mockPayments } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

type ViewPaymentsDialogProps = {
  professional: ManagedProfessional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ViewPaymentsDialog({ professional, open, onOpenChange }: ViewPaymentsDialogProps) {
  if (!professional) return null;

  const payments = mockPayments[professional.id] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
                            <TableHead>Fecha</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-right">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length > 0 ? (
                            payments.map(payment => (
                                <TableRow key={payment.id}>
                                    <TableCell>{payment.date.split('-').reverse().join('/')}</TableCell>
                                    <TableCell>{payment.plan}</TableCell>
                                    <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className={cn('border-none', payment.status === 'Pagado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                                          {payment.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron pagos.</TableCell>
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
