'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { DocumentBankDetails, DocumentLetterhead, DocumentPage, PrintButton } from '@/components/features/document-view';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  note: string | null;
}

interface InvoiceClient {
  id: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  postalCode: string | null;
  gstNumber: string | null;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  client: InvoiceClient | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  isOverdue: boolean;
  notes: string | null;
  items: InvoiceItem[];
  payments: Payment[];
}

const INVOICE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const { can } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  const canUpdate = can(PERMISSIONS.INVOICE_UPDATE);
  const canRecordPayment = can(PERMISSIONS.PAYMENT_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      setInvoice(await api.get<Invoice>(`/finance/invoices/${invoiceId}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markSent = async () => {
    try {
      await api.patch(`/finance/invoices/${invoiceId}/status`, { status: 'SENT' });
      await load();
    } catch {
      // no-op
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error || !invoice) {
    return <ErrorState message={error ?? 'Invoice not found'} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title={invoice.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 print-hidden">
            <Link
              href="/finance"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Finance
            </Link>
            {invoice.client && <span>· {invoice.client.name}</span>}
            <span>· due {formatDate(invoice.dueDate, 'long')}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2 print-hidden">
            <Badge tone={invoice.isOverdue ? 'danger' : INVOICE_TONE[invoice.status] ?? 'neutral'}>
              {invoice.isOverdue ? 'Overdue' : titleCase(invoice.status)}
            </Badge>
            <PrintButton />
            {invoice.status === 'DRAFT' && canUpdate && (
              <Button variant="secondary" size="sm" onClick={() => void markSent()}>
                Mark sent
              </Button>
            )}
            {invoice.balance > 0 && canRecordPayment && (
              <Button size="sm" onClick={() => setShowRecordPayment(true)}>
                Record payment
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentPage>
            <DocumentLetterhead />

            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-overline uppercase text-tertiary">Tax invoice</p>
                <p className="text-heading-md font-semibold text-primary">{invoice.number}</p>
              </div>
              <div className="text-right text-body-sm text-secondary">
                <p>Issued: {formatDate(invoice.issueDate, 'long')}</p>
                <p>Due: {formatDate(invoice.dueDate, 'long')}</p>
              </div>
            </div>

            {invoice.client && (
              <div className="mt-4">
                <p className="text-overline uppercase text-tertiary">Bill to</p>
                <p className="text-body-md font-medium text-primary">
                  {invoice.client.legalName || invoice.client.name}
                </p>
                {invoice.client.addressLine1 && (
                  <p className="text-body-sm text-secondary">
                    {[invoice.client.addressLine1, invoice.client.city, invoice.client.state, invoice.client.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {invoice.client.gstNumber && (
                  <p className="text-body-sm text-secondary">GSTIN: {invoice.client.gstNumber}</p>
                )}
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="py-2 pr-2 font-semibold">Description</th>
                    <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                    <th className="py-2 pr-2 text-right font-semibold">Unit price</th>
                    <th className="py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-2 text-body-sm text-primary">{item.description}</td>
                      <td className="metric py-3 pr-2 text-right text-body-sm text-secondary">
                        {item.quantity}
                      </td>
                      <td className="metric py-3 pr-2 text-right text-body-sm text-secondary">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="metric py-3 text-right text-body-sm font-medium text-primary">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto mt-4 max-w-xs space-y-1.5">
              {[
                { label: 'Subtotal', value: invoice.subtotal },
                ...(invoice.cgst > 0 ? [{ label: 'CGST', value: invoice.cgst }] : []),
                ...(invoice.sgst > 0 ? [{ label: 'SGST', value: invoice.sgst }] : []),
                ...(invoice.igst > 0 ? [{ label: 'IGST', value: invoice.igst }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-body-sm">
                  <span className="text-secondary">{row.label}</span>
                  <span className="metric text-primary">{formatCurrency(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-subtle pt-1.5 text-body-md font-semibold">
                <span className="text-primary">Total</span>
                <span className="metric text-primary">{formatCurrency(invoice.total)}</span>
              </div>
              {invoice.amountPaid > 0 && (
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-secondary">Paid</span>
                  <span className="metric text-success">{formatCurrency(invoice.amountPaid)}</span>
                </div>
              )}
              {invoice.balance > 0 && (
                <div className="flex items-center justify-between text-body-sm font-medium">
                  <span className="text-secondary">Balance due</span>
                  <span className="metric text-danger">{formatCurrency(invoice.balance)}</span>
                </div>
              )}
            </div>

            <div className="mt-8 space-y-4 border-t border-subtle pt-4">
              <DocumentBankDetails />
              {invoice.notes && (
                <div>
                  <p className="mb-1 text-overline uppercase text-tertiary">Notes</p>
                  <p className="whitespace-pre-wrap text-body-sm text-secondary">{invoice.notes}</p>
                </div>
              )}
            </div>
          </DocumentPage>
        </div>

        <div className="space-y-4 print-hidden">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardBody>
              {invoice.payments.length === 0 ? (
                <p className="text-body-sm text-secondary">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-medium text-primary">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-caption text-tertiary">
                          {titleCase(payment.method)} · {formatDate(payment.paidAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <RecordPaymentModal
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        invoiceId={invoiceId}
        balance={invoice.balance}
        onRecorded={async () => {
          setShowRecordPayment(false);
          await load();
        }}
      />
    </>
  );
}

function RecordPaymentModal({
  open,
  onClose,
  invoiceId,
  balance,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  balance: number;
  onRecorded: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(balance > 0 ? String(balance) : '');
      setMethod('BANK_TRANSFER');
      setReference('');
      setError(null);
    }
  }, [open, balance]);

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a positive amount');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/finance/invoices/${invoiceId}/payments`, {
        amount: value,
        method,
        reference: reference || undefined,
      });
      await onRecorded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not record the payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <div className="space-y-4">
        <Field label="Amount (₹)">
          <Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            {['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'RAZORPAY', 'STRIPE', 'OTHER'].map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference (optional)">
          <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="NEFT-1234" />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Record payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
