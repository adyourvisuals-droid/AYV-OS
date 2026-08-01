'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { HeartPulse } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Progress,
  Skeleton,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, healthBand } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  status: string;
  healthScore: number;
  monthlyRetainer: number | null;
  renewalDate: string | null;
  accountManager: { id: string; name: string; avatarUrl: string | null } | null;
}

export default function ClientHealthPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClients(await api.get<Client[]>('/clients?limit=100&sort=healthScore'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load client health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const atRisk = clients.filter((client) => client.healthScore < 60);
  const revenueAtRisk = atRisk.reduce(
    (sum, client) => sum + (client.monthlyRetainer ?? 0) * 12,
    0,
  );

  return (
    <>
      <PageHeader
        title="Client health"
        subtitle={
          loading
            ? 'Loading…'
            : `${atRisk.length} account(s) below 60 · ${formatCurrency(revenueAtRisk, { compact: true })} ARR at risk`
        }
      />

      <div className="p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <Skeleton className="h-96" />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<HeartPulse className="h-6 w-6" aria-hidden />}
            title="No clients to score"
            description="Health scores appear once you have active client accounts."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="px-4 py-2.5 font-semibold">Client</th>
                    <th className="w-64 px-4 py-2.5 font-semibold">Health</th>
                    <th className="px-4 py-2.5 font-semibold">Account manager</th>
                    <th className="px-4 py-2.5 text-right font-semibold">ARR</th>
                    <th className="px-4 py-2.5 font-semibold">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {clients.map((client) => {
                    const band = healthBand(client.healthScore);

                    return (
                      <tr key={client.id} className="transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-3">
                          <Link
                            href={`/clients/${client.id}`}
                            className="text-body-sm font-medium text-primary hover:text-brand-600"
                          >
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Progress value={client.healthScore} tone={band.tone} className="flex-1" />
                            <span className="metric w-8 text-right text-body-sm font-medium text-primary">
                              {client.healthScore}
                            </span>
                            <Badge tone={band.tone}>{band.label}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {client.accountManager ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={client.accountManager.name}
                                src={client.accountManager.avatarUrl}
                                size="xs"
                              />
                              <span className="text-body-sm text-secondary">
                                {client.accountManager.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-caption text-tertiary">Unassigned</span>
                          )}
                        </td>
                        <td className="metric px-4 py-3 text-right text-body-sm text-primary">
                          {client.monthlyRetainer
                            ? formatCurrency(client.monthlyRetainer * 12, { compact: true })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-secondary">
                          {formatDate(client.renewalDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
