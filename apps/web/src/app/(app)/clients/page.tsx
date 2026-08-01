'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Building2, Search } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Progress,
  Skeleton,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, healthBand, titleCase } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  healthScore: number;
  services: string[];
  monthlyRetainer: number | null;
  renewalDate: string | null;
  accountManager: { id: string; name: string; avatarUrl: string | null } | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setError(null);
    try {
      const query = term ? `?search=${encodeURIComponent(term)}&limit=50` : '?limit=50';
      setClients(await api.get<Client[]>(`/clients${query}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  const totalRetainer = clients.reduce((sum, client) => sum + (client.monthlyRetainer ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={
          loading
            ? 'Loading…'
            : `${clients.length} accounts · ${formatCurrency(totalRetainer)} monthly retainer`
        }
        actions={
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients…"
              className="w-56 pl-8"
              aria-label="Search clients"
            />
          </div>
        }
      />

      <div className="p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load(search)} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-44" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title={search ? 'No matching clients' : 'No clients yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Clients appear here once a won lead is converted.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => {
              const band = healthBand(client.healthScore);

              return (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <Card interactive className="h-full p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-heading-sm text-primary">{client.name}</p>
                        <p className="mt-0.5 truncate text-caption text-tertiary">
                          {client.industry ? titleCase(client.industry) : 'Industry not set'}
                        </p>
                      </div>
                      <Badge tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {titleCase(client.status)}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-caption text-secondary">Health</span>
                        <span className="metric text-caption font-medium text-primary">
                          {client.healthScore} · {band.label}
                        </span>
                      </div>
                      <Progress value={client.healthScore} tone={band.tone} />
                    </div>

                    <div className="mt-4 flex items-end justify-between border-t border-subtle pt-3">
                      <div>
                        <p className="text-overline uppercase text-tertiary">Retainer</p>
                        <p className="metric mt-0.5 text-body-md font-semibold text-primary">
                          {client.monthlyRetainer
                            ? `${formatCurrency(client.monthlyRetainer, { compact: true })}/mo`
                            : '—'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-overline uppercase text-tertiary">Renews</p>
                        <p className="mt-0.5 text-body-sm text-secondary">
                          {formatDate(client.renewalDate)}
                        </p>
                      </div>

                      {client.accountManager && (
                        <Avatar
                          name={client.accountManager.name}
                          src={client.accountManager.avatarUrl}
                          size="sm"
                        />
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
