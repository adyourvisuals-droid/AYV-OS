'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { Camera, MapPin, Plus, Users } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { ShootModal, type ShootForEdit } from '@/components/features/shoot-modal';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, titleCase } from '@/lib/utils';

interface Shoot {
  id: string;
  title: string;
  client: { id: string; name: string } | null;
  type: string | null;
  scheduledAt: string;
  endAt: string | null;
  location: string | null;
  crewIds: string[];
  equipment: string | null;
  notes: string | null;
  status: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CrewOption {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PLANNED: 'neutral',
  CONFIRMED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const STATUSES = ['', 'PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export default function ShootsPage() {
  const { can } = useAuth();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [crew, setCrew] = useState<CrewOption[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingShoot, setEditingShoot] = useState<ShootForEdit | null>(null);

  const canManage = can(PERMISSIONS.SHOOT_MANAGE);
  const crewById = useMemo(() => new Map(crew.map((member) => [member.id, member.name])), [crew]);

  const load = useCallback(async (statusFilter: string) => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter) params.set('status', statusFilter);
      const [shootData, clientData, crewData] = await Promise.all([
        api.get<Shoot[]>(`/creative/shoots?${params.toString()}`),
        api.get<ClientOption[]>('/clients?limit=100'),
        // Reuses the task-assignee picker — exactly "people I'm allowed to
        // allot work to", gated on TASK_READ rather than the broader HRM
        // EMPLOYEE_READ that a Creative Head has no reason to hold.
        api.get<CrewOption[]>('/tasks/assignable'),
      ]);
      setShoots(shootData);
      setClients(clientData);
      setCrew(crewData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the shoot schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shoot[]>();
    for (const shoot of shoots) {
      const key = format(new Date(shoot.scheduledAt), 'yyyy-MM-dd');
      const bucket = map.get(key) ?? [];
      bucket.push(shoot);
      map.set(key, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shoots]);

  const openEdit = (shoot: Shoot) => {
    setEditingShoot(shoot);
    setShowModal(true);
  };

  const dayLabel = (key: string) => {
    const date = new Date(`${key}T00:00:00`);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, d MMMM yyyy');
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
        title="Shoot schedule"
        subtitle={loading ? 'Loading…' : `${shoots.length} shoot(s) scheduled`}
        actions={
          canManage && (
            <Button size="sm" onClick={() => { setEditingShoot(null); setShowModal(true); }}>
              <Plus className="h-4 w-4" aria-hidden />
              New shoot
            </Button>
          )
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
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<Camera className="h-6 w-6" aria-hidden />}
            title="No shoots scheduled"
            description="Plan a shoot to see it appear here, grouped by date."
          />
        ) : (
          grouped.map(([key, dayShoots]) => (
            <div key={key}>
              <p
                className={cn(
                  'mb-2 text-body-sm font-medium',
                  isPast(new Date(`${key}T23:59:59`)) && !isToday(new Date(`${key}T00:00:00`))
                    ? 'text-tertiary'
                    : 'text-primary',
                )}
              >
                {dayLabel(key)}
              </p>
              <div className="space-y-2">
                {dayShoots.map((shoot) => (
                  <Card key={shoot.id} interactive className="cursor-pointer p-3" onClick={() => openEdit(shoot)}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-body-md font-medium text-primary">{shoot.title}</p>
                        <p className="metric text-caption text-tertiary">
                          {format(new Date(shoot.scheduledAt), 'h:mm a')}
                          {shoot.endAt && ` – ${format(new Date(shoot.endAt), 'h:mm a')}`}
                          {shoot.type && ` · ${titleCase(shoot.type)}`}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[shoot.status] ?? 'neutral'}>{titleCase(shoot.status)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-secondary">
                      {shoot.client && (
                        <Link
                          href={`/clients/${shoot.client.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-brand-600 hover:underline"
                        >
                          {shoot.client.name}
                        </Link>
                      )}
                      {shoot.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {shoot.location}
                        </span>
                      )}
                      {shoot.crewIds.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          {shoot.crewIds.map((id) => crewById.get(id) ?? 'Unknown').join(', ')}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ShootModal
        open={showModal}
        shoot={editingShoot}
        clients={clients}
        crew={crew}
        onClose={() => setShowModal(false)}
        onSaved={async () => {
          setShowModal(false);
          await load(status);
        }}
      />
    </>
  );
}
