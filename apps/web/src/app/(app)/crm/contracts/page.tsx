'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FileSignature } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface Contract {
  id: string;
  number: string;
  title: string;
  status: string;
  value: number;
  startDate: string | null;
  endDate: string | null;
  client: { id: string; name: string } | null;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  SIGNED: 'success',
  TERMINATED: 'danger',
  EXPIRED: 'warning',
};

const STATUSES = ['', 'DRAFT', 'SENT', 'SIGNED', 'TERMINATED', 'EXPIRED'];

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (statusFilter: string) => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100', sort: '-createdAt' });
      if (statusFilter) params.set('status', statusFilter);
      setContracts(await api.get<Contract[]>(`/crm/contracts?${params.toString()}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load contracts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle={loading ? 'Loading…' : `${contracts.length} contract(s) · created from a client's page`}
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
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="h-6 w-6" aria-hidden />}
            title="No contracts yet"
            description="Create one from a client's page to start tracking it here."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="px-4 py-2.5 font-semibold">Number</th>
                    <th className="px-4 py-2.5 font-semibold">Title</th>
                    <th className="px-4 py-2.5 font-semibold">Client</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                    <th className="px-4 py-2.5 font-semibold">Term</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-3 text-body-sm font-medium text-primary">{contract.number}</td>
                      <td className="px-4 py-3 text-body-sm text-secondary">{contract.title}</td>
                      <td className="px-4 py-3 text-body-sm text-secondary">
                        {contract.client ? (
                          <Link href={`/clients/${contract.client.id}`} className="hover:text-brand-600 hover:underline">
                            {contract.client.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[contract.status] ?? 'neutral'}>{titleCase(contract.status)}</Badge>
                      </td>
                      <td className="metric px-4 py-3 text-right text-body-sm font-medium text-primary">
                        {formatCurrency(contract.value)}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-secondary">
                        {contract.startDate ? formatDate(contract.startDate, 'long') : '—'}
                        {contract.endDate && ` – ${formatDate(contract.endDate, 'long')}`}
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
