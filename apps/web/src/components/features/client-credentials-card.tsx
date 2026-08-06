'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, titleCase } from '@/lib/utils';

const CATEGORIES = ['SOCIAL', 'ADS', 'HOSTING', 'DOMAIN', 'EMAIL', 'CMS', 'ANALYTICS', 'OTHER'];

interface Credential {
  id: string;
  service: string;
  category: string | null;
  loginUrl: string | null;
  username: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
}

export function ClientCredentialsCard({ clientId }: { clientId: string }) {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.CREDENTIAL_MANAGE);

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCredentials(await api.get<Credential[]>(`/clients/${clientId}/credentials`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load credentials');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setRevealing(id);
    try {
      const result = await api.post<{ secret: string }>(`/clients/${clientId}/credentials/${id}/reveal`, {});
      setRevealed((prev) => ({ ...prev, [id]: result.secret }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reveal this credential');
    } finally {
      setRevealing(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/clients/${clientId}/credentials/${id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove this credential');
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden />
          Credentials
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <p className="text-body-sm text-danger">{error}</p>}
        {credentials.length === 0 ? (
          <p className="text-body-sm text-secondary">No credentials stored yet.</p>
        ) : (
          credentials.map((credential) => (
            <div key={credential.id} className="rounded-md border border-subtle p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-medium text-primary">{credential.service}</span>
                {credential.category && (
                  <span className="text-caption text-tertiary">{titleCase(credential.category)}</span>
                )}
              </div>
              {credential.username && (
                <p className="mt-1 text-body-sm text-secondary">{credential.username}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                {revealed[credential.id] ? (
                  <code className="flex-1 truncate rounded bg-sunken px-1.5 py-0.5 text-caption text-primary">
                    {revealed[credential.id]}
                  </code>
                ) : (
                  <span className="flex-1 text-caption text-tertiary">••••••••••</span>
                )}
                <button
                  type="button"
                  title={revealed[credential.id] ? 'Hide' : 'Reveal'}
                  onClick={() => void reveal(credential.id)}
                  disabled={revealing === credential.id}
                  className="rounded p-1 text-tertiary transition-colors hover:bg-sunken hover:text-primary"
                >
                  {revealed[credential.id] ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                {revealed[credential.id] && (
                  <button
                    type="button"
                    title="Copy"
                    onClick={() => void navigator.clipboard.writeText(revealed[credential.id])}
                    className="rounded p-1 text-tertiary transition-colors hover:bg-sunken hover:text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {credential.loginUrl && (
                    <a
                      href={credential.loginUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-caption text-brand-600 hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                  <span className="text-caption text-tertiary">Updated {formatDate(credential.updatedAt)}</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void remove(credential.id)}
                    className="rounded p-1 text-tertiary transition-colors hover:bg-danger-bg hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </CardBody>

      <NewCredentialModal
        open={showNew}
        clientId={clientId}
        onClose={() => setShowNew(false)}
        onCreated={async () => {
          setShowNew(false);
          await load();
        }}
      />
    </Card>
  );
}

function NewCredentialModal({
  open,
  clientId,
  onClose,
  onCreated,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [service, setService] = useState('');
  const [category, setCategory] = useState('SOCIAL');
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setService('');
    setCategory('SOCIAL');
    setLoginUrl('');
    setUsername('');
    setSecret('');
    setNotes('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!service.trim() || !secret.trim()) {
      setError('Service and secret are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/credentials`, {
        service,
        category,
        loginUrl: loginUrl || undefined,
        username: username || undefined,
        secret,
        notes: notes || undefined,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this credential');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New credential">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service">
            <Input value={service} onChange={(event) => setService(event.target.value)} placeholder="Meta Business Suite" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Login URL (optional)">
          <Input value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Username / email">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} />
        </Field>
        <Field label="Password / secret">
          <Input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Save credential
          </Button>
        </div>
      </div>
    </Modal>
  );
}
