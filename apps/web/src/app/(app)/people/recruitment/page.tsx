'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Plus } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { titleCase } from '@/lib/utils';

interface JobOpening {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  status: string;
  openings: number;
  candidateCount: number;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning'> = {
  OPEN: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'neutral',
};

export default function RecruitmentPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canManage = can(PERMISSIONS.CANDIDATE_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOpenings(await api.get<JobOpening[]>('/hrm/job-openings?limit=100'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load job openings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Recruitment"
        subtitle={loading ? 'Loading…' : `${openings.length} job opening(s)`}
        actions={
          canManage && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New job opening
            </Button>
          )
        }
      />

      <div className="p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <Skeleton className="h-96" />
        ) : openings.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6" aria-hidden />}
            title="No job openings yet"
            description="Create one to start tracking candidates through the hiring pipeline."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openings.map((opening) => (
              <Card
                key={opening.id}
                interactive
                className="cursor-pointer p-4"
                onClick={() => router.push(`/people/recruitment/${opening.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-body-md font-medium text-primary">{opening.title}</p>
                  <Badge tone={STATUS_TONE[opening.status] ?? 'neutral'}>{titleCase(opening.status)}</Badge>
                </div>
                <p className="mt-1 text-caption text-tertiary">
                  {[opening.department, opening.location].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-subtle pt-3">
                  <span className="text-caption text-tertiary">
                    {opening.openings} opening{opening.openings === 1 ? '' : 's'}
                  </span>
                  <span className="metric text-body-sm font-medium text-primary">
                    {opening.candidateCount} candidate{opening.candidateCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateJobOpeningModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false);
          router.push(`/people/recruitment/${id}`);
        }}
      />
    </>
  );
}

function CreateJobOpeningModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [openingsCount, setOpeningsCount] = useState('1');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDepartment('');
    setLocation('');
    setEmploymentType('FULL_TIME');
    setOpeningsCount('1');
    setDescription('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/hrm/job-openings', {
        title,
        department: department || undefined,
        location: location || undefined,
        employmentType,
        openings: Number(openingsCount) || 1,
        description: description || undefined,
      });
      onCreated(created.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the job opening');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New job opening">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Senior Designer" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Creative" />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employment type">
            <Select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}>
              {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'].map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Number of openings">
            <Input type="number" value={openingsCount} onChange={(event) => setOpeningsCount(event.target.value)} />
          </Field>
        </div>
        <Field label="Description (optional)">
          <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create job opening
          </Button>
        </div>
      </div>
    </Modal>
  );
}
