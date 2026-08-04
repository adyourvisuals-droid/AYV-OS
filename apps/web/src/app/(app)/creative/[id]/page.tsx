'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, titleCase } from '@/lib/utils';

interface Revision {
  id: string;
  note: string;
  fromClient: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

interface Submission {
  id: string;
  version: number;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  revisions: Revision[];
}

interface Approval {
  id: string;
  status: string;
  isClientApproval: boolean;
  comment: string | null;
  decidedAt: string | null;
}

interface BriefDetail {
  id: string;
  title: string;
  type: string;
  brief: string | null;
  status: string;
  priority: string;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  dueDate: string | null;
  revisionCount: number;
  revisionLimit: number;
  isOverRevisionLimit: boolean;
  rating: number | null;
  turnaroundHours: number | null;
  submissions: Submission[];
  approvals: Approval[];
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  QUEUED: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  DELIVERED: 'success',
};

export default function CreativeBriefDetailPage() {
  const params = useParams<{ id: string }>();
  const briefId = params.id;
  const { can } = useAuth();

  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [approving, setApproving] = useState(false);

  const canUpdate = can(PERMISSIONS.CREATIVE_UPDATE);
  const canApprove = can(PERMISSIONS.APPROVAL_DECIDE);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBrief(await api.get<BriefDetail>(`/creative/briefs/${briefId}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the brief');
    } finally {
      setLoading(false);
    }
  }, [briefId]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    setApproving(true);
    try {
      await api.post(`/creative/briefs/${briefId}/approve`, {});
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not approve the brief');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error || !brief) {
    return <ErrorState message={error ?? 'Brief not found'} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title={brief.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/creative" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Creative
            </Link>
            {brief.client && <span>· {brief.client.name}</span>}
            {brief.dueDate && <span>· due {formatDate(brief.dueDate, 'long')}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[brief.status] ?? 'neutral'}>{titleCase(brief.status)}</Badge>
            {brief.assignee && <Avatar name={brief.assignee.name} src={brief.assignee.avatarUrl} />}
            {canUpdate && brief.status !== 'DELIVERED' && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowSubmit(true)}>
                  Submit version
                </Button>
                {brief.submissions.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setShowRevision(true)}>
                    Request revision
                  </Button>
                )}
              </>
            )}
            {canApprove && brief.status === 'IN_REVIEW' && (
              <Button size="sm" onClick={() => void approve()} loading={approving}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Approve & deliver
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {brief.brief && (
            <Card>
              <CardHeader>
                <CardTitle>Brief</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-body-sm text-secondary">{brief.brief}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Submission history</CardTitle>
            </CardHeader>
            <CardBody>
              {brief.submissions.length === 0 ? (
                <p className="text-body-sm text-secondary">No versions submitted yet.</p>
              ) : (
                <ul className="space-y-4">
                  {brief.submissions.map((submission) => (
                    <li key={submission.id} className="border-l-2 border-subtle pl-4">
                      <p className="text-body-sm font-medium text-primary">
                        Version {submission.version}
                        <span className="ml-2 text-caption font-normal text-tertiary">
                          {formatDate(submission.createdAt)}
                        </span>
                      </p>
                      {submission.notes && (
                        <p className="mt-0.5 text-body-sm text-secondary">{submission.notes}</p>
                      )}
                      {submission.fileUrl && (
                        <a
                          href={submission.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block truncate text-caption text-brand-600 hover:underline"
                        >
                          {submission.fileUrl}
                        </a>
                      )}
                      {submission.revisions.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {submission.revisions.map((revision) => (
                            <li key={revision.id} className="rounded-md bg-sunken/60 px-2.5 py-1.5">
                              <p className="text-caption text-secondary">
                                {revision.fromClient ? 'Client feedback' : 'Internal feedback'} ·{' '}
                                {formatDate(revision.createdAt)}
                              </p>
                              <p className="text-body-sm text-primary">{revision.note}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {[
                { label: 'Priority', value: titleCase(brief.priority) },
                { label: 'Revisions', value: `${brief.revisionCount} / ${brief.revisionLimit}` },
                { label: 'Turnaround', value: brief.turnaroundHours !== null ? `${brief.turnaroundHours}h` : '—' },
                { label: 'Rating', value: brief.rating !== null ? `${brief.rating}/5` : '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-body-sm text-secondary">{row.label}</span>
                  <span className="metric text-body-sm font-medium text-primary">{row.value}</span>
                </div>
              ))}
              {brief.isOverRevisionLimit && (
                <p className="rounded-md bg-danger-bg px-2.5 py-1.5 text-caption text-danger">
                  Past the contracted revision limit — treat further changes as a billable change order.
                </p>
              )}
            </CardBody>
          </Card>

          {brief.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approvals</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-2">
                  {brief.approvals.map((approval) => (
                    <li key={approval.id} className="flex items-center justify-between">
                      <span className="text-body-sm text-secondary">
                        {approval.isClientApproval ? 'Client' : 'Internal'}
                      </span>
                      <Badge tone={approval.status === 'APPROVED' ? 'success' : 'warning'}>
                        {titleCase(approval.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <SubmitVersionModal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        briefId={briefId}
        onSubmitted={async () => {
          setShowSubmit(false);
          await load();
        }}
      />
      <RequestRevisionModal
        open={showRevision}
        onClose={() => setShowRevision(false)}
        briefId={briefId}
        onSubmitted={async () => {
          setShowRevision(false);
          await load();
        }}
      />
    </>
  );
}

function SubmitVersionModal({
  open,
  onClose,
  briefId,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  briefId: string;
  onSubmitted: () => Promise<void>;
}) {
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFileUrl('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/creative/briefs/${briefId}/submissions`, {
        fileUrl: fileUrl || undefined,
        notes: notes || undefined,
      });
      await onSubmitted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit the version');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit version">
      <div className="space-y-4">
        <Field label="File URL (optional)">
          <Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Notes (optional)">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Submit for review
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RequestRevisionModal({
  open,
  onClose,
  briefId,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  briefId: string;
  onSubmitted: () => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [fromClient, setFromClient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setFromClient(false);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!note.trim()) {
      setError('A note is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/creative/briefs/${briefId}/revisions`, { note, fromClient });
      await onSubmitted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not request the revision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request revision">
      <div className="space-y-4">
        <Field label="Feedback">
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-body-sm text-secondary">
          <input type="checkbox" checked={fromClient} onChange={(event) => setFromClient(event.target.checked)} />
          This feedback came from the client
        </label>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Send back to production
          </Button>
        </div>
      </div>
    </Modal>
  );
}
