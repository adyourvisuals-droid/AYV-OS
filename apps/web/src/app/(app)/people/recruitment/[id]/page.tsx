'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, titleCase } from '@/lib/utils';

interface Candidate {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  resumeUrl: string | null;
  stage: string;
  score: number | null;
}

interface Column {
  stage: string;
  count: number;
  candidates: Candidate[];
}

interface JobOpening {
  id: string;
  title: string;
  department: string | null;
  status: string;
}

export default function RecruitmentBoardPage() {
  const params = useParams<{ id: string }>();
  const jobOpeningId = params.id;
  const { can } = useAuth();

  const [opening, setOpening] = useState<JobOpening | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Candidate | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showNewCandidate, setShowNewCandidate] = useState(false);
  const [rejecting, setRejecting] = useState<Candidate | null>(null);

  const canManage = can(PERMISSIONS.CANDIDATE_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [openingData, boardData] = await Promise.all([
        api.get<JobOpening>(`/hrm/job-openings/${jobOpeningId}`),
        api.get<Column[]>(`/hrm/job-openings/${jobOpeningId}/board`),
      ]);
      setOpening(openingData);
      setColumns(boardData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the job opening');
    } finally {
      setLoading(false);
    }
  }, [jobOpeningId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveCandidate = async (candidate: Candidate, toStage: string, rejectionReason?: string) => {
    if (candidate.stage === toStage) return;
    try {
      await api.patch(`/hrm/candidates/${candidate.id}/stage`, { stage: toStage, rejectionReason });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not move the candidate');
    }
  };

  const handleDrop = (toStage: string) => {
    if (!dragging) return;
    if (toStage === 'REJECTED') {
      setRejecting(dragging);
    } else {
      void moveCandidate(dragging, toStage);
    }
    setDragging(null);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-96 w-64 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !opening) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }
  if (!opening) return null;

  return (
    <>
      <PageHeader
        title={opening.title}
        subtitle={
          <span className="flex items-center gap-2">
            <Link href="/people/recruitment" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Recruitment
            </Link>
            {opening.department && <span>· {opening.department}</span>}
          </span>
        }
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowNewCandidate(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New candidate
            </Button>
          )
        }
      />

      {error && <p className="px-6 pt-3 text-body-sm text-danger">{error}</p>}

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
              handleDrop(column.stage);
            }}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-lg border transition-colors duration-150',
              dropTarget === column.stage ? 'border-brand-500 bg-brand-50/50' : 'border-subtle bg-sunken/40',
            )}
          >
            <div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
              <span className="text-heading-sm text-primary">{titleCase(column.stage)}</span>
              <Badge>{column.count}</Badge>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {column.candidates.length === 0 ? (
                <p className="px-2 py-8 text-center text-caption text-tertiary">Drop a candidate here</p>
              ) : (
                column.candidates.map((candidate) => (
                  <Card
                    key={candidate.id}
                    draggable={canManage}
                    onDragStart={() => setDragging(candidate)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    className={cn(
                      'p-3',
                      canManage && 'cursor-grab active:cursor-grabbing',
                      dragging?.id === candidate.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Avatar name={candidate.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-primary">{candidate.name}</p>
                        {candidate.email && (
                          <p className="truncate text-caption text-tertiary">{candidate.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {candidate.resumeUrl ? (
                        <a
                          href={candidate.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-caption text-brand-600 hover:underline"
                        >
                          Resume
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span />
                      )}
                      {candidate.score !== null && (
                        <span className="metric text-caption font-medium text-secondary">{candidate.score}/100</span>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <NewCandidateModal
        open={showNewCandidate}
        jobOpeningId={jobOpeningId}
        onClose={() => setShowNewCandidate(false)}
        onCreated={async () => {
          setShowNewCandidate(false);
          await load();
        }}
      />

      <RejectCandidateModal
        candidate={rejecting}
        onClose={() => setRejecting(null)}
        onRejected={async (reason) => {
          if (rejecting) await moveCandidate(rejecting, 'REJECTED', reason);
          setRejecting(null);
        }}
      />
    </>
  );
}

function NewCandidateModal({
  open,
  jobOpeningId,
  onClose,
  onCreated,
}: {
  open: boolean;
  jobOpeningId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPhone('');
    setResumeUrl('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      setError('A name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/hrm/job-openings/${jobOpeningId}/candidates`, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        resumeUrl: resumeUrl || undefined,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the candidate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New candidate">
      <div className="space-y-4">
        <Field label="Full name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Sharma" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>
        <Field label="Resume URL (optional)">
          <Input value={resumeUrl} onChange={(event) => setResumeUrl(event.target.value)} placeholder="https://…" />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Add candidate
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RejectCandidateModal({
  candidate,
  onClose,
  onRejected,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onRejected: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setReason('');
  }, [candidate]);

  if (!candidate) return null;

  return (
    <Modal open={Boolean(candidate)} onClose={onClose} title={`Reject ${candidate.name}`}>
      <div className="space-y-4">
        <Field label="Reason">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onRejected(reason);
              setSubmitting(false);
            }}
          >
            Reject candidate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
