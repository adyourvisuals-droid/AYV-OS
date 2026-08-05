'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import Link from 'next/link';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
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
import { cn, formatCurrency, formatDate, formatRelative, titleCase } from '@/lib/utils';

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  dueDate: string | null;
  estimatedHours: number | null;
  labels: string[];
  clientVisible: boolean;
  isOverdue: boolean;
  commentCount: number;
  subtaskCount: number;
}

interface BoardColumn {
  status: string;
  count: number;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  progress: number;
  client: { id: string; name: string } | null;
  manager: { id: string; name: string; avatarUrl: string | null } | null;
  members: { id: string; name: string; avatarUrl: string | null }[];
  dueDate: string | null;
  budget: number | null;
  internalCost: number | null;
  margin: number | null;
}

interface Health {
  status: string;
  risks: { type: string; severity: string; message: string }[];
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-danger',
  HIGH: 'bg-danger',
  MEDIUM: 'bg-warning',
  LOW: 'bg-tertiary',
};

export default function ProjectBoardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);

  const { can } = useAuth();
  const canCreateTask = can(PERMISSIONS.TASK_CREATE);
  const canUpdateTask = can(PERMISSIONS.TASK_UPDATE);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectData, boardData, healthData] = await Promise.all([
        api.get<Project>(`/projects/${projectId}`),
        api.get<BoardColumn[]>(`/projects/${projectId}/board`),
        api.get<Health>(`/projects/${projectId}/health`),
      ]);
      setProject(projectData);
      setColumns(boardData);
      setHealth(healthData);

      // The server decides who this person may allot work to; a failure here
      // just means the assignee picker stays empty, not that the board breaks.
      try {
        setAssignable(await api.get<AssignableUser[]>('/tasks/assignable'));
      } catch {
        setAssignable([]);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveTask = async (task: Task, toStatus: string) => {
    if (task.status === toStatus) return;

    const previous = columns;

    setColumns((current) =>
      current.map((column) => {
        if (column.status === task.status) {
          const tasks = column.tasks.filter((entry) => entry.id !== task.id);
          return { ...column, tasks, count: tasks.length };
        }
        if (column.status === toStatus) {
          const tasks = [{ ...task, status: toStatus }, ...column.tasks];
          return { ...column, tasks, count: tasks.length };
        }
        return column;
      }),
    );

    try {
      await api.patch(`/tasks/${task.id}/move`, { status: toStatus });
      await load();
    } catch {
      setColumns(previous);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-96 flex-1" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return <ErrorState message={error ?? 'Project not found'} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Projects
            </Link>
            <span className="font-mono text-tertiary">{project.code}</span>
            {project.client && <span>· {project.client.name}</span>}
            {project.dueDate && <span>· due {formatDate(project.dueDate, 'long')}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            {project.manager && <Avatar name={project.manager.name} src={project.manager.avatarUrl} />}
            <AvatarGroup people={project.members} max={4} />
            {canCreateTask && (
              <Button size="sm" onClick={() => setShowNewTask(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New task
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-overline uppercase text-tertiary">Progress</span>
              <span className="metric text-heading-sm text-primary">{project.progress}%</span>
            </div>
            <Progress
              value={project.progress}
              tone={project.progress >= 70 ? 'success' : 'brand'}
            />
            <p className="mt-2 text-caption text-tertiary">
              {columns.reduce((sum, column) => sum + column.count, 0)} tasks across{' '}
              {columns.length} columns
            </p>
          </Card>

          {/* Rendered only when the API included financials for this role. */}
          {project.budget !== null && (
            <Card className="p-5">
              <span className="text-overline uppercase text-tertiary">Budget</span>
              <p className="metric mt-2 text-heading-md text-primary">
                {formatCurrency(project.budget)}
              </p>
              <p className="mt-1 text-caption text-secondary">
                {project.internalCost !== null &&
                  `${formatCurrency(project.internalCost)} spent`}
                {project.margin !== null && ` · ${project.margin}% margin`}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <span className="text-overline uppercase text-tertiary">Health</span>
            {health && health.risks.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-body-md font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                On track
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {health?.risks.map((risk) => (
                  <p
                    key={risk.type}
                    className={cn(
                      'flex items-start gap-1.5 text-body-sm',
                      risk.severity === 'HIGH' ? 'text-danger' : 'text-warning',
                    )}
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {risk.message}
                  </p>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <div
              key={column.status}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.status);
              }}
              onDragLeave={() =>
                setDropTarget((current) => (current === column.status ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                if (dragging) void moveTask(dragging, column.status);
                setDragging(null);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border transition-colors duration-150',
                dropTarget === column.status
                  ? 'border-brand-500 bg-brand-50/50'
                  : 'border-subtle bg-sunken/40',
              )}
            >
              <div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
                <span className="text-heading-sm text-primary">{titleCase(column.status)}</span>
                <Badge>{column.count}</Badge>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {column.tasks.length === 0 ? (
                  <p className="px-2 py-8 text-center text-caption text-tertiary">
                    Drop a task here
                  </p>
                ) : (
                  column.tasks.map((task) => (
                    <Card
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      onClick={() => {
                        if (canUpdateTask) setEditingTask(task);
                      }}
                      interactive
                      className={cn(
                        'cursor-grab p-3 active:cursor-grabbing',
                        dragging?.id === task.id && 'opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            PRIORITY_DOT[task.priority] ?? 'bg-tertiary',
                          )}
                          title={titleCase(task.priority)}
                        />
                        <p className="min-w-0 flex-1 text-body-sm font-medium text-primary">
                          {task.title}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {task.assignee ? (
                            <Avatar
                              name={task.assignee.name}
                              src={task.assignee.avatarUrl}
                              size="xs"
                            />
                          ) : (
                            <span className="text-caption text-tertiary">Unassigned</span>
                          )}
                          {task.estimatedHours !== null && (
                            <span className="metric text-caption text-tertiary">
                              {task.estimatedHours}h
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {task.clientVisible && (
                            <Badge tone="info" className="px-1.5">
                              client
                            </Badge>
                          )}
                          {task.dueDate && (
                            <Badge tone={task.isOverdue ? 'danger' : 'neutral'} className="px-1.5">
                              {formatRelative(task.dueDate)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TaskModal
        open={showNewTask || Boolean(editingTask)}
        task={editingTask}
        projectId={projectId}
        assignable={assignable}
        onClose={() => {
          setShowNewTask(false);
          setEditingTask(null);
        }}
        onSaved={async () => {
          setShowNewTask(false);
          setEditingTask(null);
          await load();
        }}
      />
    </>
  );
}

/** Creates a task when `task` is null, otherwise edits that task. */
function TaskModal({
  open,
  task,
  projectId,
  assignable,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  projectId: string;
  assignable: AssignableUser[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDescription('');
    setAssigneeId(task?.assignee?.id ?? '');
    setPriority(task?.priority ?? 'MEDIUM');
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : '');
    setError(null);
  }, [open, task]);

  const submit = async () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      assigneeId: assigneeId || null,
      priority,
      dueDate: dueDate || null,
      ...(task ? {} : { projectId, description: description || undefined }),
    };

    try {
      if (task) {
        await api.patch(`/tasks/${task.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit task' : 'New task'}>
      <div className="space-y-4">
        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Draft the launch storyboard"
          />
        </Field>

        {!task && (
          <Field label="Description (optional)">
            <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        )}

        <Field label="Assign to">
          <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Unassigned</option>
            {assignable.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.designation ? ` — ${person.designation}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
