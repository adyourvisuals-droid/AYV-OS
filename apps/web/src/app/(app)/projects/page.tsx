'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FolderKanban } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import {
  AvatarGroup,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Progress,
  Skeleton,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, formatCurrency, formatRelative, titleCase } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  priority: string;
  progress: number;
  client: { id: string; name: string } | null;
  members: { id: string; name: string; avatarUrl: string | null }[];
  dueDate: string | null;
  budget: number | null;
  margin: number | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  PLANNING: 'info',
  REVIEW: 'warning',
  ON_HOLD: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filter: string) => {
    setError(null);
    try {
      const query = filter ? `?status=${filter}&limit=50` : '?limit=50';
      setProjects(await api.get<Project[]>(`/projects${query}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  const filters = ['', 'ACTIVE', 'PLANNING', 'REVIEW', 'ON_HOLD', 'COMPLETED'];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={loading ? 'Loading…' : `${projects.length} projects`}
        actions={
          <div className="flex flex-wrap gap-1 rounded-md border border-subtle bg-surface p-0.5">
            {filters.map((filter) => (
              <button
                key={filter || 'all'}
                type="button"
                onClick={() => setStatus(filter)}
                className={cn(
                  'rounded px-2.5 py-1 text-caption font-medium transition-colors',
                  status === filter
                    ? 'bg-brand-500 text-white'
                    : 'text-secondary hover:text-primary',
                )}
              >
                {filter ? titleCase(filter) : 'All'}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load(status)} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-48" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" aria-hidden />}
            title="No projects here"
            description="Projects are created automatically when a lead is converted, or manually from this screen."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const overdue =
                project.dueDate !== null &&
                new Date(project.dueDate) < new Date() &&
                project.status !== 'COMPLETED';

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card interactive className="h-full p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-heading-sm text-primary">{project.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-caption text-tertiary">
                          <span className="font-mono">{project.code}</span>
                          {project.client && <span>· {project.client.name}</span>}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[project.status] ?? 'neutral'}>
                        {titleCase(project.status)}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-caption text-secondary">Progress</span>
                        <span className="metric text-caption font-medium text-primary">
                          {project.progress}%
                        </span>
                      </div>
                      <Progress
                        value={project.progress}
                        tone={project.progress >= 70 ? 'success' : 'brand'}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3">
                      <AvatarGroup people={project.members} max={3} />

                      <div className="flex items-center gap-3">
                        {/* Redacted server-side for roles without finance visibility. */}
                        {project.margin !== null && (
                          <span
                            className="metric text-caption text-secondary"
                            title={
                              project.budget
                                ? `Budget ${formatCurrency(project.budget)}`
                                : undefined
                            }
                          >
                            {project.margin}% margin
                          </span>
                        )}
                        <Badge tone={overdue ? 'danger' : 'neutral'}>
                          {project.dueDate ? formatRelative(project.dueDate) : 'No date'}
                        </Badge>
                      </div>
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
