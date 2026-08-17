'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Repeat } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { MetricCard } from '@/components/features/metric-card';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Progress,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, titleCase } from '@/lib/utils';

interface DeliverableItem {
  id: string;
  label: string;
  committed: number;
  delivered: number;
}

interface Retainer {
  id: string;
  title: string;
  client: { id: string; name: string } | null;
  monthlyValue: number;
  currency: string;
  billingCycle: string;
  status: string;
  deliverablesTemplate: { label: string; quantity: number }[];
  period: {
    month: number;
    year: number;
    generated: boolean;
    committedTotal: number;
    deliveredTotal: number;
    items: DeliverableItem[];
  };
}

interface ClientOption {
  id: string;
  name: string;
}
interface PackageOption {
  id: string;
  name: string;
  price: number;
  billingCycle: string;
  deliverables: { label: string; quantity: number }[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2000, i, 1), 'MMMM') }));

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  ENDED: 'neutral',
};

export default function RetainersPage() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.RETAINER_MANAGE);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [retainerData, clientData, packageData] = await Promise.all([
        api.get<Retainer[]>(`/agency/retainers?month=${month}&year=${year}`),
        api.get<ClientOption[]>('/clients?limit=100'),
        api.get<PackageOption[]>('/agency/packages?active=true').catch(() => []),
      ]);
      setRetainers(retainerData);
      setClients(clientData);
      setPackages(packageData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load retainers');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const active = retainers.filter((r) => r.status === 'ACTIVE');
    const mrr = active.reduce((sum, r) => sum + (r.billingCycle === 'MONTHLY' ? r.monthlyValue : 0), 0);
    const committed = retainers.reduce((sum, r) => sum + r.period.committedTotal, 0);
    const delivered = retainers.reduce((sum, r) => sum + r.period.deliveredTotal, 0);
    return { count: active.length, mrr, pct: committed > 0 ? Math.round((delivered / committed) * 100) : 0 };
  }, [retainers]);

  const generate = async (retainerId: string) => {
    try {
      await api.post(`/agency/retainers/${retainerId}/generate`, { month, year });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start the month');
    }
  };

  const bump = async (itemId: string, delta: number) => {
    // Optimistic: adjust locally, then persist.
    setRetainers((prev) =>
      prev.map((r) => ({
        ...r,
        period: {
          ...r.period,
          items: r.period.items.map((it) =>
            it.id === itemId ? { ...it, delivered: Math.max(0, it.delivered + delta) } : it,
          ),
          deliveredTotal: r.period.items.some((it) => it.id === itemId)
            ? Math.max(0, r.period.deliveredTotal + delta)
            : r.period.deliveredTotal,
        },
      })),
    );
    try {
      await api.patch(`/agency/retainers/deliverables/${itemId}`, { delta });
    } catch {
      void load();
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

  return (
    <>
      <PageHeader
        title="Retainers"
        subtitle="What each client is owed this month, and how much has shipped."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New retainer
            </Button>
          )
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => (m === 1 ? (setYear((y) => y - 1), 12) : m - 1))} aria-label="Previous month">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => (m === 12 ? (setYear((y) => y + 1), 1) : m + 1))} aria-label="Next month">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Active retainers" value={String(totals.count)} />
          <MetricCard label="Monthly recurring" value={formatCurrency(totals.mrr, { compact: true })} />
          <MetricCard label="Delivered this month" value={`${totals.pct}%`} tone={totals.pct >= 80 ? 'success' : totals.pct >= 40 ? 'warning' : 'danger'} />
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        {retainers.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-6 w-6" aria-hidden />}
            title="No retainers yet"
            description={canManage ? 'Create a retainer to start tracking monthly deliverables per client.' : 'Nothing has been set up yet.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {retainers.map((retainer) => {
              const pct =
                retainer.period.committedTotal > 0
                  ? Math.round((retainer.period.deliveredTotal / retainer.period.committedTotal) * 100)
                  : 0;
              return (
                <Card key={retainer.id}>
                  <CardBody className="space-y-3 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {retainer.client ? (
                          <Link href={`/clients/${retainer.client.id}`} className="text-body-md font-medium text-primary hover:text-brand-600 hover:underline">
                            {retainer.client.name}
                          </Link>
                        ) : (
                          <p className="text-body-md font-medium text-primary">—</p>
                        )}
                        <p className="text-caption text-tertiary">
                          {retainer.title} · {formatCurrency(retainer.monthlyValue)} {retainer.billingCycle === 'MONTHLY' ? '/mo' : titleCase(retainer.billingCycle)}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[retainer.status] ?? 'neutral'}>{titleCase(retainer.status)}</Badge>
                    </div>

                    {!retainer.period.generated ? (
                      <div className="flex items-center justify-between rounded-md border border-dashed border-subtle px-3 py-3">
                        <p className="text-body-sm text-tertiary">This month hasn&apos;t been started yet.</p>
                        {canManage && (
                          <Button size="sm" variant="secondary" onClick={() => void generate(retainer.id)}>
                            Start month
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-caption text-secondary">
                            <span>
                              {retainer.period.deliveredTotal} / {retainer.period.committedTotal} delivered
                            </span>
                            <span className="metric font-medium text-primary">{pct}%</span>
                          </div>
                          <Progress value={pct} tone={pct >= 100 ? 'success' : 'brand'} />
                        </div>

                        <ul className="space-y-1.5">
                          {retainer.period.items.map((item) => {
                            const done = item.delivered >= item.committed;
                            return (
                              <li key={item.id} className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                                    done ? 'bg-success text-white' : 'border border-subtle',
                                  )}
                                >
                                  {done && <Check className="h-2.5 w-2.5" aria-hidden />}
                                </span>
                                <span className="flex-1 truncate text-body-sm text-secondary">{item.label}</span>
                                <span className="metric text-body-sm font-medium text-primary">
                                  {item.delivered}/{item.committed}
                                </span>
                                {canManage && (
                                  <span className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label={`Reduce ${item.label}`}
                                      onClick={() => void bump(item.id, -1)}
                                      className="rounded p-1 text-tertiary transition-colors hover:bg-sunken hover:text-primary"
                                    >
                                      <Minus className="h-3.5 w-3.5" aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Add ${item.label}`}
                                      onClick={() => void bump(item.id, 1)}
                                      className="rounded p-1 text-tertiary transition-colors hover:bg-brand-50 hover:text-brand-600"
                                    >
                                      <Plus className="h-3.5 w-3.5" aria-hidden />
                                    </button>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NewRetainerModal
        open={showNew}
        clients={clients}
        packages={packages}
        onClose={() => setShowNew(false)}
        onCreated={async () => {
          setShowNew(false);
          await load();
        }}
      />
    </>
  );
}

function NewRetainerModal({
  open,
  clients,
  packages,
  onClose,
  onCreated,
}: {
  open: boolean;
  clients: ClientOption[];
  packages: PackageOption[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [title, setTitle] = useState('');
  const [monthlyValue, setMonthlyValue] = useState('');
  const [template, setTemplate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientId(clients[0]?.id ?? '');
    setPackageId('');
    setTitle('');
    setMonthlyValue('');
    setTemplate('');
    setError(null);
  }, [open, clients]);

  // Picking a package prefills the title, value and deliverables (all editable).
  const applyPackage = (id: string) => {
    setPackageId(id);
    const pkg = packages.find((p) => p.id === id);
    if (pkg) {
      setTitle((t) => t || pkg.name);
      setMonthlyValue(String(pkg.price));
      setTemplate(pkg.deliverables.map((d) => `${d.label} x${d.quantity}`).join('\n'));
    }
  };

  const submit = async () => {
    if (!clientId) {
      setError('Select a client');
      return;
    }
    // "Instagram reels x12" per line → { label, quantity }.
    const deliverablesTemplate = template
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.*?)\s*[x×]\s*(\d+)\s*$/i);
        if (m) return { label: m[1].trim(), quantity: Number(m[2]) };
        return { label: line, quantity: 1 };
      });

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/agency/retainers', {
        clientId,
        packageId: packageId || undefined,
        title: title || undefined,
        monthlyValue: monthlyValue ? Number(monthlyValue) : undefined,
        deliverablesTemplate,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the retainer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New retainer">
      <div className="space-y-4">
        <Field label="Client">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {packages.length > 0 && (
          <Field label="Start from a package (optional)">
            <Select value={packageId} onChange={(e) => applyPackage(e.target.value)}>
              <option value="">Custom retainer</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Social Media — Growth" />
          </Field>
          <Field label="Monthly value (₹)">
            <Input type="number" min="0" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} />
          </Field>
        </div>
        <Field label="Committed deliverables (one per line, e.g. Instagram reels x12)">
          <Textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder={'Instagram reels x12\nStatic posts x20\nMonthly report x1'} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create retainer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
