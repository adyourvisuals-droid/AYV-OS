'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { parseTerms } from '@/components/features/contract-modal';
import { DocumentLetterhead, DocumentPage, PrintButton } from '@/components/features/document-view';
import { Badge, Button, ErrorState, Field, Input, Modal, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface Contract {
  id: string;
  number: string;
  title: string;
  client: { id: string; name: string } | null;
  leadId: string | null;
  status: string;
  value: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  noticePeriodDays: number | null;
  signedAt: string | null;
  signedByName: string | null;
  documentUrl: string | null;
  terms: unknown;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  SIGNED: 'success',
  TERMINATED: 'danger',
  EXPIRED: 'warning',
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = params.id;
  const { can } = useAuth();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setContract(await api.get<Contract>(`/crm/contracts/${contractId}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the contract');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveStatus = async (status: string, signedByName?: string) => {
    try {
      await api.patch(`/crm/contracts/${contractId}/status`, { status, signedByName });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the contract');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !contract) {
    return <ErrorState message={error ?? 'Contract not found'} onRetry={() => void load()} />;
  }

  const clauses = parseTerms(contract.terms);

  return (
    <>
      <PageHeader
        title={contract.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 print-hidden">
            <Link href="/crm/contracts" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Contracts
            </Link>
            <span>· {contract.number}</span>
            {contract.client && <span>· {contract.client.name}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 print-hidden">
            <Badge tone={STATUS_TONE[contract.status] ?? 'neutral'}>{titleCase(contract.status)}</Badge>
            <PrintButton />
            {contract.status === 'DRAFT' && can(PERMISSIONS.CONTRACT_CREATE) && (
              <Button size="sm" onClick={() => void moveStatus('SENT')}>
                Send for signature
              </Button>
            )}
            {contract.status === 'SENT' && can(PERMISSIONS.CONTRACT_APPROVE) && (
              <Button size="sm" onClick={() => setShowSignModal(true)}>
                Mark signed
              </Button>
            )}
            {contract.status === 'SIGNED' && can(PERMISSIONS.CONTRACT_APPROVE) && (
              <Button variant="danger" size="sm" onClick={() => void moveStatus('TERMINATED')}>
                Terminate
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        <DocumentPage>
          <DocumentLetterhead />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-overline uppercase text-tertiary">Contract</p>
              <p className="text-heading-md font-semibold text-primary">{contract.title}</p>
              <p className="text-body-sm text-secondary">{contract.number}</p>
            </div>
            <div className="text-right text-body-sm text-secondary">
              <p>Date: {formatDate(contract.createdAt, 'long')}</p>
              {contract.startDate && (
                <p>
                  Term: {formatDate(contract.startDate, 'long')}
                  {contract.endDate && ` – ${formatDate(contract.endDate, 'long')}`}
                </p>
              )}
              {contract.noticePeriodDays !== null && <p>Notice period: {contract.noticePeriodDays} days</p>}
            </div>
          </div>

          {contract.client && (
            <div className="mt-4">
              <p className="text-overline uppercase text-tertiary">Between</p>
              <Link
                href={`/clients/${contract.client.id}`}
                className="text-body-md font-medium text-primary hover:text-brand-600 hover:underline"
              >
                {contract.client.name}
              </Link>
            </div>
          )}

          <div className="mt-6 rounded-md border border-subtle bg-sunken/40 px-4 py-3">
            <div className="flex items-center justify-between text-body-md font-semibold">
              <span className="text-primary">Contract value</span>
              <span className="metric text-primary">{formatCurrency(contract.value)}</span>
            </div>
          </div>

          {contract.signedByName && (
            <p className="mt-4 text-body-sm text-secondary">
              Signed by <span className="font-medium text-primary">{contract.signedByName}</span> on{' '}
              {formatDate(contract.signedAt, 'long')}
            </p>
          )}

          {clauses.length > 0 ? (
            <div className="mt-8 space-y-4 border-t border-subtle pt-4">
              <p className="text-overline uppercase text-tertiary">Terms &amp; conditions</p>
              {clauses.map((clause, index) => (
                <div key={index}>
                  {clause.title && <p className="text-body-sm font-medium text-primary">{clause.title}</p>}
                  {clause.body && (
                    <p className="whitespace-pre-wrap text-body-sm text-secondary">{clause.body}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 border-t border-subtle pt-4 text-body-sm text-tertiary print-hidden">
              No terms &amp; conditions have been added to this contract yet.
            </p>
          )}
        </DocumentPage>
      </div>

      <SignContractModal
        open={showSignModal}
        onClose={() => setShowSignModal(false)}
        onSigned={async (name) => {
          setShowSignModal(false);
          await moveStatus('SIGNED', name);
        }}
      />
    </>
  );
}

function SignContractModal({
  open,
  onClose,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  onSigned: (signedByName: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Mark contract as signed">
      <div className="space-y-4">
        <Field label="Signed by">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Client's signatory name" autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            loading={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onSigned(name.trim());
              setSubmitting(false);
            }}
          >
            Confirm signed
          </Button>
        </div>
      </div>
    </Modal>
  );
}
