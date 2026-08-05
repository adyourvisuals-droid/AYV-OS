'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface Quotation {
  id: string;
  number: string;
  status: string;
  total: number;
  validUntil: string | null;
  lead: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const STATUSES = ['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export default function QuotationsPage() {
  const { can } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (statusFilter: string) => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100', sort: '-createdAt' });
      if (statusFilter) params.set('status', statusFilter);
      setQuotations(await api.get<Quotation[]>(`/crm/quotations?${params.toString()}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load quotations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  const moveStatus = async (id: string, next: string) => {
    try {
      await api.patch(`/crm/quotations/${id}/status`, { status: next });
      await load(status);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the quotation');
    }
  };

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle={
          loading
            ? 'Loading…'
            : `${quotations.length} quotation(s) · created from a lead or client's page`
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((option) => (
            <button
              key={option || 'all'}
              type="button"
              onClick={() => setStatus(option)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-caption font-medium transition-colors',
                status === option
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-subtle text-secondary hover:text-primary',
              )}
            >
              {option ? titleCase(option) : 'All'}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => void load(status)} />
        ) : loading ? (
          <Skeleton className="h-96" />
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="No quotations yet"
            description="Create one from a lead's page to start tracking it here."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="px-4 py-2.5 font-semibold">Number</th>
                    <th className="px-4 py-2.5 font-semibold">Lead / Client</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Valid until</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {quotations.map((quotation) => (
                    <tr key={quotation.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-3 text-body-sm font-medium text-primary">{quotation.number}</td>
                      <td className="px-4 py-3 text-body-sm text-secondary">
                        {quotation.lead ? (
                          <Link href={`/crm/leads/${quotation.lead.id}`} className="hover:text-brand-600 hover:underline">
                            {quotation.lead.name}
                          </Link>
                        ) : quotation.client ? (
                          <Link href={`/clients/${quotation.client.id}`} className="hover:text-brand-600 hover:underline">
                            {quotation.client.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[quotation.status] ?? 'neutral'}>{titleCase(quotation.status)}</Badge>
                      </td>
                      <td className="metric px-4 py-3 text-right text-body-sm font-medium text-primary">
                        {formatCurrency(quotation.total)}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-secondary">
                        {formatDate(quotation.validUntil, 'long')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {quotation.status === 'SENT' && can(PERMISSIONS.QUOTATION_APPROVE) && (
                            <>
                              <Button size="sm" onClick={() => void moveStatus(quotation.id, 'ACCEPTED')}>
                                Accepted
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void moveStatus(quotation.id, 'REJECTED')}
                              >
                                Rejected
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
