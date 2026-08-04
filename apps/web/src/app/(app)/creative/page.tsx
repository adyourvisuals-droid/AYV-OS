'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { Avatar, Badge, Button, Card, ErrorState, Field, Input, Modal, Select, Skeleton, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatDate, titleCase } from '@/lib/utils';

interface Brief {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  dueDate: string | null;
  revisionCount: number;
  revisionLimit: number;
  isOverRevisionLimit: boolean;
  submissionCount: number;
}

interface ClientOption {
  id: string;
  name: string;
}

const COLUMNS = [
  { key: 'QUEUED', label: 'Queued' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-danger',
  HIGH: 'bg-danger',
  MEDIUM: 'bg-warning',
  LOW: 'bg-tertiary',
};

const TYPE_LABEL: Record<string, string> = {
  DESIGN: 'Design',
  VIDEO: 'Video',
  CONTENT: 'Content',
  THUMBNAIL: 'Thumbnail',
  COPY: 'Copy',
  SCRIPT: 'Script',
  AI_CONTENT: 'AI content',
};

export default function CreativePage() {
  const { can } = useAuth();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Brief | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showNewBrief, setShowNewBrief] = useState(false);

  const canCreate = can(PERMISSIONS.CREATIVE_CREATE);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [briefData, clientData] = await Promise.all([
        api.get<Brief[]>('/creative/briefs?limit=200'),
        api.get<ClientOption[]>('/clients?limit=100'),
      ]);
      setBriefs(briefData);
      setClients(clientData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the creative queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moveBrief = async (brief: Brief, toStatus: string) => {
    if (brief.status === toStatus) return;

    const previous = briefs;
    setBriefs((current) => current.map((b) => (b.id === brief.id ? { ...b, status: toStatus } : b)));

    try {
      await api.patch(`/creative/briefs/${brief.id}/status`, { status: toStatus });
      await load();
    } catch {
      setBriefs(previous);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto p-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title="Creative Production"
        subtitle={`${briefs.length} brief(s) in the queue`}
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setShowNewBrief(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New brief
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-3 overflow-x-auto p-6">
        {COLUMNS.map((column) => {
          const columnBriefs = briefs.filter((brief) => brief.status === column.key);

          return (
            <div
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.key);
              }}
              onDragLeave={() => setDropTarget((current) => (current === column.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                if (dragging) void moveBrief(dragging, column.key);
                setDragging(null);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-lg border transition-colors duration-150',
                dropTarget === column.key ? 'border-brand-500 bg-brand-50/50' : 'border-subtle bg-sunken/40',
              )}
            >
              <div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
                <span className="text-heading-sm text-primary">{column.label}</span>
                <Badge>{columnBriefs.length}</Badge>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {columnBriefs.length === 0 ? (
                  <p className="px-2 py-8 text-center text-caption text-tertiary">Nothing here</p>
                ) : (
                  columnBriefs.map((brief) => (
                    <Link key={brief.id} href={`/creative/${brief.id}`}>
                      <Card
                        draggable
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDragging(brief);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        interactive
                        className={cn('cursor-grab p-3 active:cursor-grabbing', dragging?.id === brief.id && 'opacity-40')}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[brief.priority] ?? 'bg-tertiary')}
                            title={titleCase(brief.priority)}
                          />
                          <p className="min-w-0 flex-1 text-body-sm font-medium text-primary">{brief.title}</p>
                        </div>

                        <p className="mt-1.5 text-caption text-tertiary">
                          {TYPE_LABEL[brief.type] ?? brief.type}
                          {brief.client && ` · ${brief.client.name}`}
                        </p>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {brief.assignee ? (
                              <Avatar name={brief.assignee.name} src={brief.assignee.avatarUrl} size="xs" />
                            ) : (
                              <span className="text-caption text-tertiary">Unassigned</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {brief.isOverRevisionLimit && (
                              <Badge tone="danger" className="px-1.5">
                                {brief.revisionCount}/{brief.revisionLimit} revisions
                              </Badge>
                            )}
                            {brief.dueDate && (
                              <Badge tone="neutral" className="px-1.5">
                                {formatDate(brief.dueDate)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewBriefModal
        open={showNewBrief}
        onClose={() => setShowNewBrief(false)}
        clients={clients}
        onCreated={async () => {
          setShowNewBrief(false);
          await load();
        }}
      />
    </>
  );
}

function NewBriefModal({
  open,
  onClose,
  clients,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('DESIGN');
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setType('DESIGN');
      setClientId('');
      setDueDate('');
      setBrief('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/creative/briefs', {
        title,
        type,
        clientId: clientId || undefined,
        dueDate: dueDate || undefined,
        brief: brief || undefined,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the brief');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New brief">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Instagram carousel — launch" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client (optional)">
            <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>
        <Field label="Brief (optional)">
          <Textarea rows={3} value={brief} onChange={(event) => setBrief(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create brief
          </Button>
        </div>
      </div>
    </Modal>
  );
}
