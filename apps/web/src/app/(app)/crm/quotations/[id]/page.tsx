'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { DocumentLetterhead, DocumentPage, PrintButton } from '@/components/features/document-view';
import { Badge, Button, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface QuotationItem {
  id: string;
  service: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Quotation {
  id: string;
  number: string;
  status: string;
  lead: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  validUntil: string | null;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  terms: string | null;
  notes: string | null;
  sentAt: string | null;
  items: QuotationItem[];
  createdAt: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const quotationId = params.id;
  const { can } = useAuth();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQuotation(await api.get<Quotation>(`/crm/quotations/${quotationId}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the quotation');
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveStatus = async (next: string) => {
    try {
      await api.patch(`/crm/quotations/${quotationId}/status`, { status: next });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the quotation');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !quotation) {
    return <ErrorState message={error ?? 'Quotation not found'} onRetry={() => void load()} />;
  }

  const party = quotation.lead ?? quotation.client;
  const partyHref = quotation.lead ? `/crm/leads/${quotation.lead.id}` : quotation.client ? `/clients/${quotation.client.id}` : null;

  return (
    <>
      <PageHeader
        title={quotation.number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 print-hidden">
            <Link href="/crm/quotations" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Quotations
            </Link>
            {party && <span>· {party.name}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 print-hidden">
            <Badge tone={STATUS_TONE[quotation.status] ?? 'neutral'}>{titleCase(quotation.status)}</Badge>
            <PrintButton />
            {quotation.status === 'SENT' && can(PERMISSIONS.QUOTATION_APPROVE) && (
              <>
                <Button size="sm" onClick={() => void moveStatus('ACCEPTED')}>
                  Mark accepted
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void moveStatus('REJECTED')}>
                  Mark rejected
                </Button>
              </>
            )}
            {quotation.status === 'DRAFT' && can(PERMISSIONS.QUOTATION_UPDATE) && (
              <Button size="sm" onClick={() => void moveStatus('SENT')}>
                Mark sent
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        <DocumentPage>
          <DocumentLetterhead />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-overline uppercase text-tertiary">Quotation</p>
              <p className="text-heading-md font-semibold text-primary">{quotation.number}</p>
            </div>
            <div className="text-right text-body-sm text-secondary">
              <p>Date: {formatDate(quotation.createdAt, 'long')}</p>
              {quotation.validUntil && <p>Valid until: {formatDate(quotation.validUntil, 'long')}</p>}
            </div>
          </div>

          {party && (
            <div className="mt-4">
              <p className="text-overline uppercase text-tertiary">Prepared for</p>
              {partyHref ? (
                <Link href={partyHref} className="text-body-md font-medium text-primary print:no-underline hover:text-brand-600 hover:underline">
                  {party.name}
                </Link>
              ) : (
                <p className="text-body-md font-medium text-primary">{party.name}</p>
              )}
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="py-2 pr-2 font-semibold">Service / description</th>
                  <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                  <th className="py-2 pr-2 text-right font-semibold">Unit price</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {quotation.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-2 text-body-sm text-primary">
                      {item.service && <span className="mr-1.5 text-tertiary">{titleCase(item.service)} ·</span>}
                      {item.description}
                    </td>
                    <td className="metric py-3 pr-2 text-right text-body-sm text-secondary">{item.quantity}</td>
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
            <div className="flex items-center justify-between text-body-sm">
              <span className="text-secondary">Subtotal</span>
              <span className="metric text-primary">{formatCurrency(quotation.subtotal)}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-secondary">Discount</span>
                <span className="metric text-primary">-{formatCurrency(quotation.discount)}</span>
              </div>
            )}
            {quotation.taxAmount > 0 && (
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-secondary">Tax ({quotation.taxRate}%)</span>
                <span className="metric text-primary">{formatCurrency(quotation.taxAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-subtle pt-1.5 text-body-md font-semibold">
              <span className="text-primary">Total</span>
              <span className="metric text-primary">{formatCurrency(quotation.total)}</span>
            </div>
          </div>

          {(quotation.terms || quotation.notes) && (
            <div className="mt-8 space-y-4 border-t border-subtle pt-4">
              {quotation.terms && (
                <div>
                  <p className="mb-1 text-overline uppercase text-tertiary">Terms & conditions</p>
                  <p className="whitespace-pre-wrap text-body-sm text-secondary">{quotation.terms}</p>
                </div>
              )}
              {quotation.notes && (
                <div>
                  <p className="mb-1 text-overline uppercase text-tertiary">Notes</p>
                  <p className="whitespace-pre-wrap text-body-sm text-secondary">{quotation.notes}</p>
                </div>
              )}
            </div>
          )}
        </DocumentPage>
      </div>
    </>
  );
}
