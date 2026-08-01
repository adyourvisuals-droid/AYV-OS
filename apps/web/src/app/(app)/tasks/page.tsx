'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckSquare } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, formatRelative, titleCase } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  projectName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}

const NEXT_STATUS: Record<string, string> = {
  BACKLOG: 'TODO',
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_REVIEW',
  IN_REVIEW: 'DONE',
  BLOCKED: 'IN_PROGRESS',
};

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTasks(await api.get<Task[]>('/tasks/my'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;

    setBusyId(task.id);
    try {
      await api.patch(`/tasks/${task.id}/move`, { status: next });
      await load();
    } catch {
      // The list reloads on the next successful action; leave state as-is.
    } finally {
      setBusyId(null);
    }
  };

  const overdue = tasks.filter((task) => task.isOverdue);
  const rest = tasks.filter((task) => !task.isOverdue);

  return (
    <>
      <PageHeader
        title="My tasks"
        subtitle={
          loading
            ? 'Loading…'
            : `${tasks.length} open · ${overdue.length} overdue · ordered by urgency`
        }
      />

      <div className="space-y-4 p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <Skeleton className="h-80" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-6 w-6" aria-hidden />}
            title="Nothing assigned to you"
            description="When work is assigned, it appears here in priority order."
          />
        ) : (
          <>
            {overdue.length > 0 && (
              <TaskGroup
                title="Overdue"
                tasks={overdue}
                busyId={busyId}
                onAdvance={advance}
                tone="danger"
              />
            )}
            <TaskGroup title="Upcoming" tasks={rest} busyId={busyId} onAdvance={advance} />
          </>
        )}
      </div>
    </>
  );
}

function TaskGroup({
  title,
  tasks,
  busyId,
  onAdvance,
  tone,
}: {
  title: string;
  tasks: Task[];
  busyId: string | null;
  onAdvance: (task: Task) => void;
  tone?: 'danger';
}) {
  if (tasks.length === 0) return null;

  return (
    <Card>
      <div className="border-b border-subtle px-5 py-3">
        <h2 className={cn('text-heading-sm', tone === 'danger' ? 'text-danger' : 'text-primary')}>
          {title}
          <span className="ml-2 text-body-sm font-normal text-tertiary">{tasks.length}</span>
        </h2>
      </div>

      <ul className="divide-y divide-subtle">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                task.priority === 'URGENT' || task.priority === 'HIGH'
                  ? 'bg-danger'
                  : task.priority === 'MEDIUM'
                    ? 'bg-warning'
                    : 'bg-tertiary',
              )}
              title={titleCase(task.priority)}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-primary">{task.title}</p>
              <p className="truncate text-caption text-tertiary">
                {task.projectName ?? 'No project'} · {titleCase(task.status)}
              </p>
            </div>

            <Badge tone={task.isOverdue ? 'danger' : 'neutral'}>
              {task.dueDate ? formatRelative(task.dueDate) : 'No date'}
            </Badge>

            {NEXT_STATUS[task.status] && (
              <Button
                variant="secondary"
                size="sm"
                loading={busyId === task.id}
                onClick={() => onAdvance(task)}
              >
                → {titleCase(NEXT_STATUS[task.status])}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
