'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Target } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { CreateLeadModal } from '@/components/features/create-lead-modal';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatRelative, titleCase } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  temperature: string;
  estimatedValue: number;
  score: number;
  closeProbability: number | null;
  daysInStage: number;
  lastActivityAt: string | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
}

const TEMPERATURE_TONE: Record<string, 'danger' | 'warning' | 'info'> = {
  HOT: 'danger',
  WARM: 'warning',
  COLD: 'info',
};

export default function LeadsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (term: string, statusFilter: string) => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50', sort: '-score' });
      if (term) params.set('search', term);
      if (statusFilter) params.set('status', statusFilter);

      const result = await api.getWithMeta<Lead[]>(`/crm/leads?${params.toString()}`);
      setLeads(result.data);
      setTotal(Number(result.meta.total ?? result.data.length));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(search, status), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, status, load]);

  const statuses = ['', 'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={loading ? 'Loading…' : `${total} leads visible to you`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leads…"
                className="w-56 pl-8"
                aria-label="Search leads"
              />
            </div>
            {can(PERMISSIONS.LEAD_CREATE) && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New lead
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1">
          {statuses.map((option) => (
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
          <ErrorState message={error} onRetry={() => void load(search, status)} />
        ) : loading ? (
          <Skeleton className="h-96" />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Target className="h-6 w-6" aria-hidden />}
            title="No leads match this view"
            description="Adjust the filters, or capture a new enquiry to get started."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="px-4 py-2.5 font-semibold">Lead</th>
                    <th className="px-4 py-2.5 font-semibold">Stage</th>
                    <th className="px-4 py-2.5 font-semibold">Temp</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Score</th>
                    <th className="px-4 py-2.5 font-semibold">Owner</th>
                    <th className="px-4 py-2.5 font-semibold">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/crm/leads/${lead.id}`)}
                      className="cursor-pointer transition-colors hover:bg-sunken/60"
                    >
                      <td className="px-4 py-3">
                        <p className="text-body-sm font-medium text-primary">{lead.name}</p>
                        <p className="text-caption text-tertiary">
                          {lead.contactName ?? lead.email ?? lead.phone ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{titleCase(lead.status)}</Badge>
                        <p className="mt-0.5 text-caption text-tertiary">
                          {lead.daysInStage}d in stage
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TEMPERATURE_TONE[lead.temperature] ?? 'neutral'}>
                          {titleCase(lead.temperature)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="metric text-body-sm font-medium text-primary">
                          {formatCurrency(lead.estimatedValue)}
                        </span>
                        {lead.closeProbability !== null && (
                          <p className="text-caption text-tertiary">
                            {Math.round(lead.closeProbability * 100)}% to close
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1 w-10 overflow-hidden rounded-full bg-sunken">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                lead.score >= 70
                                  ? 'bg-success'
                                  : lead.score >= 45
                                    ? 'bg-warning'
                                    : 'bg-danger',
                              )}
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                          <span className="metric w-6 text-right text-caption font-medium text-secondary">
                            {lead.score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.owner ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={lead.owner.name} src={lead.owner.avatarUrl} size="xs" />
                            <span className="text-body-sm text-secondary">
                              {lead.owner.name.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-caption text-tertiary">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-secondary">
                        {formatRelative(lead.lastActivityAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <CreateLeadModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false);
          router.push(`/crm/leads/${id}`);
        }}
      />
    </>
  );
}
