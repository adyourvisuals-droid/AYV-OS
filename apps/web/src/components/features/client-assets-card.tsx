'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FolderOpen, Plus, Trash2 } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Modal, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { titleCase } from '@/lib/utils';

const ASSET_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOGO', 'FONT', 'OTHER'];

interface Asset {
  id: string;
  name: string;
  fileUrl: string | null;
  mimeType: string;
  tags: string[];
  uploadedBy: { id: string; name: string } | null;
}

export function ClientAssetsCard({ clientId }: { clientId: string }) {
  const { can } = useAuth();
  const canCreate = can(PERMISSIONS.ASSET_CREATE);
  const canDelete = can(PERMISSIONS.ASSET_DELETE);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssets(await api.get<Asset[]>(`/clients/${clientId}/assets`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load assets');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    try {
      await api.delete(`/clients/${clientId}/assets/${id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove this asset');
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4" aria-hidden />
          Assets
        </CardTitle>
        {canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-2">
        {error && <p className="text-body-sm text-danger">{error}</p>}
        {assets.length === 0 ? (
          <p className="text-body-sm text-secondary">No brand assets recorded yet.</p>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between gap-2 rounded-md border border-subtle p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-primary">{asset.name}</p>
                <p className="text-caption text-tertiary">{titleCase(asset.mimeType)}</p>
              </div>
              <div className="flex items-center gap-1">
                {asset.fileUrl && (
                  <a
                    href={asset.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open"
                    className="rounded p-1 text-tertiary transition-colors hover:bg-sunken hover:text-brand-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
                {canDelete && (
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void remove(asset.id)}
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

      <NewAssetModal
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

function NewAssetModal({
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
  const [name, setName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [mimeType, setMimeType] = useState('IMAGE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setFileUrl('');
    setMimeType('IMAGE');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !fileUrl.trim()) {
      setError('Name and link are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/clients/${clientId}/assets`, { name, fileUrl, mimeType });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this asset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New asset">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Logo pack — 2026" />
        </Field>
        <Field label="Link">
          <Input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://drive.google.com/…" />
        </Field>
        <Field label="Type">
          <Select value={mimeType} onChange={(event) => setMimeType(event.target.value)}>
            {ASSET_TYPES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Save asset
          </Button>
        </div>
      </div>
    </Modal>
  );
}
