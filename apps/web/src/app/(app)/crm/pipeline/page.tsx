'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flame, Plus, Snowflake, Sun } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { Avatar, Badge, Button, Card, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, formatCurrency, titleCase } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  contactName: string | null;
  status: string;
  temperature: 'HOT' | 'WARM' | 'COLD';
  services: string[];
  estimatedValue: number;
  score: number;
  closeProbability: number | null;
  daysInStage: number;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
}

interface Column {
  stage: string;
  count: number;
  value: number;
  leads: Lead[];
}

const TEMPERATURE = {
  HOT: { icon: Flame, tone: 'danger' as const, label: 'Hot' },
  WARM: { icon: Sun, tone: 'warning' as const, label: 'Warm' },
  COLD: { icon: Snowflake, tone: 'info' as const, label: 'Cold' },
};

export default function PipelinePage() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setColumns(await api.get<Column[]>('/crm/leads/board'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Optimistic move: the card jumps immediately, and the board reloads from
   * the server on failure. A pipeline that lags behind the cursor feels
   * broken even when it is merely honest.
   */
  const moveLead = async (lead: Lead, toStage: string) => {
    if (lead.status === toStage) return;

    const previous = columns;

    setColumns((current) =>
      current.map((column) => {
        if (column.stage === lead.status) {
          const leads = column.leads.filter((entry) => entry.id !== lead.id);
          return {
            ...column,
            leads,
            count: leads.length,
            value: leads.reduce((sum, entry) => sum + entry.estimatedValue, 0),
          };
        }
        if (column.stage === toStage) {
          const leads = [{ ...lead, status: toStage, daysInStage: 0 }, ...column.leads];
          return {
            ...column,
            leads,
            count: leads.length,
            value: leads.reduce((sum, entry) => sum + entry.estimatedValue, 0),
          };
        }
        return column;
      }),
    );

    try {
      // WON and LOST both require context the board cannot supply, so the
      // reason is stamped here and refined on the lead detail screen.
      await api.patch(`/crm/leads/${lead.id}/stage`, {
        status: toStage,
        ...(toStage === 'LOST' ? { reason: 'Moved to lost from the pipeline board' } : {}),
      });
      await load();
    } catch {
      setColumns(previous);
    }
  };

  const totalValue = columns.reduce((sum, column) => sum + column.value, 0);
  const totalDeals = columns.reduce((sum, column) => sum + column.count, 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={
          loading
            ? 'Loading…'
            : `${totalDeals} deals · ${formatCurrency(totalValue)} total value`
        }
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden />
            New lead
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <div className="flex gap-3 overflow-x-auto p-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto p-6">
          {columns.map((column) => (
            <div
              key={column.stage}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.stage);
              }}
              onDragLeave={() => setDropTarget((current) => (current === column.stage ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                if (dragging) void moveLead(dragging, column.stage);
                setDragging(null);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border transition-colors duration-150',
                dropTarget === column.stage
                  ? 'border-brand-500 bg-brand-50/50'
                  : 'border-subtle bg-sunken/40',
              )}
            >
              <div className="flex items-center justify-between border-b border-subtle px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-heading-sm text-primary">{titleCase(column.stage)}</span>
                  <Badge>{column.count}</Badge>
                </div>
                <span className="metric text-caption text-tertiary">
                  {formatCurrency(column.value, { compact: true })}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {column.leads.length === 0 ? (
                  <p className="px-2 py-8 text-center text-caption text-tertiary">
                    Drop a deal here
                  </p>
                ) : (
                  column.leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onDragStart={() => setDragging(lead)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      isDragging={dragging?.id === lead.id}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LeadCard({
  lead,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  lead: Lead;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const temperature = TEMPERATURE[lead.temperature];
  const TemperatureIcon = temperature.icon;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      interactive
      className={cn(
        'cursor-grab p-3 active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-body-sm font-semibold text-primary">
          {lead.name}
        </p>
        <Badge tone={temperature.tone} className="shrink-0">
          <TemperatureIcon className="h-3 w-3" aria-hidden />
          {temperature.label}
        </Badge>
      </div>

      {lead.contactName && (
        <p className="mt-0.5 truncate text-caption text-tertiary">{lead.contactName}</p>
      )}

      <p className="metric mt-2 text-heading-sm text-primary">
        {formatCurrency(lead.estimatedValue)}
      </p>

      {lead.services.length > 0 && (
        <p className="mt-1 truncate text-caption text-secondary">
          {lead.services.map(titleCase).join(' · ')}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-subtle pt-2.5">
        <div className="flex items-center gap-1.5">
          {lead.owner ? (
            <Avatar name={lead.owner.name} src={lead.owner.avatarUrl} size="xs" />
          ) : (
            <span className="text-caption text-tertiary">Unassigned</span>
          )}
          <span className="text-caption text-tertiary">{lead.daysInStage}d</span>
        </div>

        <div className="flex items-center gap-1.5" title={`AI score ${lead.score}/100`}>
          <div className="h-1 w-10 overflow-hidden rounded-full bg-sunken">
            <div
              className={cn(
                'h-full rounded-full',
                lead.score >= 70 ? 'bg-success' : lead.score >= 45 ? 'bg-warning' : 'bg-danger',
              )}
              style={{ width: `${lead.score}%` }}
            />
          </div>
          <span className="metric text-caption font-medium text-secondary">{lead.score}</span>
        </div>
      </div>
    </Card>
  );
}
