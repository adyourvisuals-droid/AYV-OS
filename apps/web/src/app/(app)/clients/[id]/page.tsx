'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
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
  email: string | null;
  phone: string | null;
  city: string | null;
  services: string[];
  monthlyRetainer: number | null;
  renewalDate: string | null;
  contractStartDate: string | null;
  accountManager: { id: string; name: string; avatarUrl: string | null } | null;
  contacts: { id: string; name: string; email: string | null; designation: string | null; isPrimary: boolean }[];
  counts: { projects: number; invoices: number; tickets: number };
}

interface HealthResult {
  score: number;
  band: string;
  signals: { key: string; label: string; weight: number; score: number; detail: string }[];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const clientData = await api.get<Client>(`/clients/${clientId}`);
      setClient(clientData);

      // Health is a separate call because it recomputes from live data;
      // a failure here must not block the rest of the page.
      try {
        setHealth(await api.get<HealthResult>(`/clients/${clientId}/health`));
      } catch {
        setHealth(null);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the client');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return <ErrorState message={error ?? 'Client not found'} onRetry={() => void load()} />;
  }

  const band = healthBand(health?.score ?? client.healthScore);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href="/clients"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Clients
            </Link>
            {client.industry && <span>· {titleCase(client.industry)}</span>}
            {client.city && <span>· {client.city}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {titleCase(client.status)}
            </Badge>
            {client.accountManager && (
              <Avatar name={client.accountManager.name} src={client.accountManager.avatarUrl} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Health breakdown</CardTitle>
            <div className="flex items-center gap-2">
              <span className="metric text-heading-md text-primary">
                {health?.score ?? client.healthScore}
              </span>
              <Badge tone={band.tone}>{band.label}</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {health ? (
              <ul className="space-y-3">
                {health.signals.map((signal) => (
                  <li key={signal.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-body-sm font-medium text-primary">
                        {signal.label}
                        <span className="ml-1.5 text-caption font-normal text-tertiary">
                          {Math.round(signal.weight * 100)}% weight
                        </span>
                      </span>
                      <span className="metric text-body-sm text-secondary">{signal.score}</span>
                    </div>
                    <Progress
                      value={signal.score}
                      tone={
                        signal.score >= 70 ? 'success' : signal.score >= 40 ? 'warning' : 'danger'
                      }
                    />
                    <p className="mt-1 text-caption text-tertiary">{signal.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-secondary">
                Health breakdown is not available for this account.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commercials</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {[
                {
                  label: 'Monthly retainer',
                  value: client.monthlyRetainer
                    ? formatCurrency(client.monthlyRetainer)
                    : '—',
                },
                {
                  label: 'Annual value',
                  value: client.monthlyRetainer
                    ? formatCurrency(client.monthlyRetainer * 12, { compact: true })
                    : '—',
                },
                { label: 'Contract started', value: formatDate(client.contractStartDate, 'long') },
                { label: 'Renews', value: formatDate(client.renewalDate, 'long') },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-body-sm text-secondary">{row.label}</span>
                  <span className="metric text-body-sm font-medium text-primary">{row.value}</span>
                </div>
              ))}

              {client.services.length > 0 && (
                <div className="border-t border-subtle pt-3">
                  <p className="mb-1.5 text-overline uppercase text-tertiary">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {client.services.map((service) => (
                      <Badge key={service} tone="brand">
                        {titleCase(service)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Projects', value: client.counts.projects },
                { label: 'Invoices', value: client.counts.invoices },
                { label: 'Tickets', value: client.counts.tickets },
              ].map((item) => (
                <div key={item.label}>
                  <p className="metric text-heading-md text-primary">{item.value}</p>
                  <p className="text-caption text-tertiary">{item.label}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          {client.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-2.5">
                  {client.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-2.5">
                      <Avatar name={contact.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-primary">
                          {contact.name}
                        </p>
                        <p className="truncate text-caption text-tertiary">
                          {contact.designation ?? contact.email ?? '—'}
                        </p>
                      </div>
                      {contact.isPrimary && <Badge tone="brand">Primary</Badge>}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
