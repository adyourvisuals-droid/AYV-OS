'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, PhoneCall } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { LogActivityModal } from '@/components/features/log-activity-modal';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatRelative, titleCase } from '@/lib/utils';

interface FollowUpLead {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  estimatedValue: number;
  status: string;
  nextFollowUpAt: string;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
}

interface Buckets {
  overdue: FollowUpLead[];
  today: FollowUpLead[];
  upcoming: FollowUpLead[];
}

export default function FollowUpsPage() {
  const router = useRouter();
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<FollowUpLead | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBuckets(await api.get<Buckets>('/crm/leads/follow-ups'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load follow-ups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error && !buckets) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }
  if (!buckets) return null;

  const total = buckets.overdue.length + buckets.today.length + buckets.upcoming.length;

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={
          total === 0
            ? "You're all caught up"
            : `${buckets.overdue.length} overdue · ${buckets.today.length} due today · ${buckets.upcoming.length} upcoming`
        }
      />

      <div className="space-y-6 p-6">
        {error && <p className="text-body-sm text-danger">{error}</p>}

        {total === 0 ? (
          <EmptyState
            icon={<CalendarCheck2 className="h-6 w-6" aria-hidden />}
            title="No follow-ups scheduled"
            description="Set a next follow-up date from a lead's page, or when you log a call or meeting."
          />
        ) : (
          <>
            <FollowUpSection
              title="Overdue"
              tone="danger"
              leads={buckets.overdue}
              onOpen={(id) => router.push(`/crm/leads/${id}`)}
              onLog={setLogFor}
            />
            <FollowUpSection
              title="Due today"
              tone="warning"
              leads={buckets.today}
              onOpen={(id) => router.push(`/crm/leads/${id}`)}
              onLog={setLogFor}
            />
            <FollowUpSection
              title="Upcoming"
              tone="neutral"
              leads={buckets.upcoming}
              onOpen={(id) => router.push(`/crm/leads/${id}`)}
              onLog={setLogFor}
            />
          </>
        )}
      </div>

      <LogActivityModal
        open={Boolean(logFor)}
        leadId={logFor?.id ?? ''}
        leadName={logFor?.name}
        onClose={() => setLogFor(null)}
        onLogged={async () => {
          setLogFor(null);
          await load();
        }}
      />
    </>
  );
}

function FollowUpSection({
  title,
  tone,
  leads,
  onOpen,
  onLog,
}: {
  title: string;
  tone: 'danger' | 'warning' | 'neutral';
  leads: FollowUpLead[];
  onOpen: (id: string) => void;
  onLog: (lead: FollowUpLead) => void;
}) {
  if (leads.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-heading-sm text-primary">{title}</h2>
        <Badge tone={tone}>{leads.length}</Badge>
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-subtle">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => onOpen(lead.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Avatar name={lead.owner?.name ?? lead.name} src={lead.owner?.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-primary hover:text-brand-600">
                    {lead.name}
                  </p>
                  <p className="truncate text-caption text-tertiary">
                    {lead.contactName ?? lead.phone ?? titleCase(lead.status)}
                    {lead.owner && ` · ${lead.owner.name}`}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-3">
                <span className="metric text-body-sm text-secondary">{formatCurrency(lead.estimatedValue)}</span>
                <Badge tone={tone === 'neutral' ? 'neutral' : tone}>{formatRelative(lead.nextFollowUpAt)}</Badge>
                <Button size="sm" variant="secondary" onClick={() => onLog(lead)}>
                  <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                  Log
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
