'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Radio, Send, Settings2, XCircle } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Modal, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, titleCase } from '@/lib/utils';

interface CapiConfig {
  id: string;
  pixelId: string;
  datasetId: string | null;
  testEventCode: string | null;
  defaultEventName: string;
  isActive: boolean;
  hasAccessToken: boolean;
  updatedAt: string;
}

interface CapiEvent {
  id: string;
  eventName: string;
  status: string;
  testMode: boolean;
  errorMessage: string | null;
  fbTraceId: string | null;
  requestPayload: unknown;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  SENT: 'success',
  TEST: 'info',
  SKIPPED: 'neutral',
  FAILED: 'danger',
  PENDING: 'warning',
};

const EVENT_NAMES = ['Lead', 'Purchase', 'CompleteRegistration', 'Subscribe', 'Contact', 'SubmitApplication'];

/**
 * Advanced CRM: the client's Meta Conversions API wiring. Configure the pixel
 * and (encrypted) access token, then fire a dry-run or live test event and
 * watch the dispatch log — the same path a won lead takes automatically.
 */
export function ClientCapiCard({ clientId }: { clientId: string }) {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.CAPI_MANAGE);

  const [config, setConfig] = useState<CapiConfig | null>(null);
  const [events, setEvents] = useState<CapiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [configData, eventData] = await Promise.all([
        api.get<CapiConfig | null>(`/clients/${clientId}/capi`),
        api.get<CapiEvent[]>(`/clients/${clientId}/capi/events?take=8`).catch(() => []),
      ]);
      setConfig(configData);
      setEvents(eventData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load Meta CAPI');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendTest = async (dryRun: boolean) => {
    setTesting(true);
    setError(null);
    setPreview(null);
    try {
      const result = await api.post<{ event: CapiEvent; result: { request?: unknown } | null }>(
        `/clients/${clientId}/capi/test`,
        { dryRun },
      );
      setPreview(result.result?.request ?? null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the test event');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-4 w-4" aria-hidden />
          Meta Conversions API
        </CardTitle>
        <div className="flex items-center gap-2">
          {config && (
            <Badge tone={config.isActive ? 'success' : 'neutral'}>
              {config.isActive ? 'Active' : 'Paused'}
            </Badge>
          )}
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setShowConfig(true)}>
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              {config ? 'Edit' : 'Configure'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <p className="text-body-sm text-danger">{error}</p>}

        {!config ? (
          <p className="text-body-sm text-secondary">
            Not connected. Add this client&apos;s Meta pixel and access token to report won leads back
            to Meta for ad optimization.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-body-sm">
              <div>
                <p className="text-caption text-tertiary">Pixel / dataset</p>
                <p className="metric text-primary">{config.pixelId}</p>
              </div>
              <div>
                <p className="text-caption text-tertiary">Default event</p>
                <p className="text-primary">{config.defaultEventName}</p>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void sendTest(true)} loading={testing}>
                  <Radio className="h-3.5 w-3.5" aria-hidden />
                  Dry-run
                </Button>
                <Button size="sm" onClick={() => void sendTest(false)} loading={testing}>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Send test event
                </Button>
              </div>
            )}

            {preview != null && (
              <div>
                <p className="mb-1 text-caption text-tertiary">Payload sent to Meta (token redacted)</p>
                <pre className="max-h-48 overflow-auto rounded-md bg-sunken p-2 text-caption text-primary">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}

        {events.length > 0 && (
          <div>
            <p className="mb-1.5 text-caption text-tertiary">Recent dispatches</p>
            <ul className="space-y-1.5">
              {events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="flex items-center gap-1.5 text-secondary">
                    {event.status === 'SENT' || event.status === 'TEST' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                    ) : event.status === 'FAILED' ? (
                      <XCircle className="h-3.5 w-3.5 text-danger" aria-hidden />
                    ) : (
                      <Radio className="h-3.5 w-3.5 text-tertiary" aria-hidden />
                    )}
                    {event.eventName}
                    {event.testMode && <span className="text-caption text-tertiary">· test</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[event.status] ?? 'neutral'}>{titleCase(event.status)}</Badge>
                    <span className="text-caption text-tertiary">{formatDate(event.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>

      {canManage && (
        <CapiConfigModal
          open={showConfig}
          clientId={clientId}
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={async () => {
            setShowConfig(false);
            await load();
          }}
        />
      )}
    </Card>
  );
}

function CapiConfigModal({
  open,
  clientId,
  config,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId: string;
  config: CapiConfig | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [pixelId, setPixelId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [testEventCode, setTestEventCode] = useState('');
  const [defaultEventName, setDefaultEventName] = useState('Lead');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPixelId(config?.pixelId ?? '');
    setDatasetId(config?.datasetId ?? '');
    setAccessToken('');
    setTestEventCode(config?.testEventCode ?? '');
    setDefaultEventName(config?.defaultEventName ?? 'Lead');
    setIsActive(config?.isActive ?? true);
    setError(null);
  }, [open, config]);

  const submit = async () => {
    if (!pixelId.trim()) {
      setError('Pixel / dataset ID is required');
      return;
    }
    if (!config && !accessToken.trim()) {
      setError('Access token is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/clients/${clientId}/capi`, {
        pixelId,
        datasetId: datasetId || undefined,
        accessToken: accessToken || undefined,
        testEventCode: testEventCode || undefined,
        defaultEventName,
        isActive,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the config');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.delete(`/clients/${clientId}/capi`);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove the config');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Meta Conversions API">
      <div className="space-y-4">
        <Field label="Pixel / dataset ID">
          <Input value={pixelId} onChange={(event) => setPixelId(event.target.value)} placeholder="1234567890" />
        </Field>
        <Field label="Dataset ID (optional)">
          <Input value={datasetId} onChange={(event) => setDatasetId(event.target.value)} placeholder="Same as pixel unless separate" />
        </Field>
        <Field label={config ? 'Access token (leave blank to keep current)' : 'Access token'}>
          <Input
            type="password"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            autoComplete="new-password"
            placeholder={config?.hasAccessToken ? '•••••••• stored' : 'EAAG…'}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default event">
            <Select value={defaultEventName} onChange={(event) => setDefaultEventName(event.target.value)}>
              {EVENT_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Test event code (optional)">
            <Input value={testEventCode} onChange={(event) => setTestEventCode(event.target.value)} placeholder="TEST12345" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-body-sm text-secondary">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active — dispatch conversions for this client
        </label>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {config ? (
            <Button variant="danger" onClick={() => void remove()} disabled={submitting}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={submitting}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
