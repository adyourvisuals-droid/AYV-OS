'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

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
  Progress,
  Select,
  Skeleton,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, healthBand, titleCase } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  healthScore: number;
  email: string | null;
  phone: string | null;
  city: string | null;
  services: string[];
  monthlyRetainer: number | null;
  renewalDate: string | null;
  contractStartDate: string | null;
  accountManager: { id: string; name: string; avatarUrl: string | null } | null;
  contacts: { id: string; name: string; email: string | null; designation: string | null; isPrimary: boolean }[];
  counts: { projects: number; invoices: number; tickets: number };
  customFields: Record<string, unknown>;
}

interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  position: number;
}

interface HealthResult {
  score: number;
  band: string;
  signals: { key: string; label: string; weight: number; score: number; detail: string }[];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const { canAny } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeCustomFields = canAny(PERMISSIONS.SETTING_READ, PERMISSIONS.CUSTOM_FIELD_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      const clientData = await api.get<Client>(`/clients/${clientId}`);
      setClient(clientData);

      // Health is a separate call because it recomputes from live data;
      // a failure here must not block the rest of the page.
      try {
        setHealth(await api.get<HealthResult>(`/clients/${clientId}/health`));
      } catch {
        setHealth(null);
      }

      // Not every viewer can see the custom-field registry; a 403 here
      // just means the section doesn't render, not a page failure.
      if (canSeeCustomFields) {
        try {
          setFieldDefs(await api.get<CustomFieldDefinition[]>('/settings/custom-fields?entityType=CLIENT'));
        } catch {
          setFieldDefs([]);
        }
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the client');
    } finally {
      setLoading(false);
    }
  }, [clientId, canSeeCustomFields]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return <ErrorState message={error ?? 'Client not found'} onRetry={() => void load()} />;
  }

  const band = healthBand(health?.score ?? client.healthScore);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href="/clients"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Clients
            </Link>
            {client.industry && <span>· {titleCase(client.industry)}</span>}
            {client.city && <span>· {client.city}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {titleCase(client.status)}
            </Badge>
            {client.accountManager && (
              <Avatar name={client.accountManager.name} src={client.accountManager.avatarUrl} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Health breakdown</CardTitle>
            <div className="flex items-center gap-2">
              <span className="metric text-heading-md text-primary">
                {health?.score ?? client.healthScore}
              </span>
              <Badge tone={band.tone}>{band.label}</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {health ? (
              <ul className="space-y-3">
                {health.signals.map((signal) => (
                  <li key={signal.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-body-sm font-medium text-primary">
                        {signal.label}
                        <span className="ml-1.5 text-caption font-normal text-tertiary">
                          {Math.round(signal.weight * 100)}% weight
                        </span>
                      </span>
                      <span className="metric text-body-sm text-secondary">{signal.score}</span>
                    </div>
                    <Progress
                      value={signal.score}
                      tone={
                        signal.score >= 70 ? 'success' : signal.score >= 40 ? 'warning' : 'danger'
                      }
                    />
                    <p className="mt-1 text-caption text-tertiary">{signal.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-secondary">
                Health breakdown is not available for this account.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commercials</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {[
                {
                  label: 'Monthly retainer',
                  value: client.monthlyRetainer
                    ? formatCurrency(client.monthlyRetainer)
                    : '—',
                },
                {
                  label: 'Annual value',
                  value: client.monthlyRetainer
                    ? formatCurrency(client.monthlyRetainer * 12, { compact: true })
                    : '—',
                },
                { label: 'Contract started', value: formatDate(client.contractStartDate, 'long') },
                { label: 'Renews', value: formatDate(client.renewalDate, 'long') },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-body-sm text-secondary">{row.label}</span>
                  <span className="metric text-body-sm font-medium text-primary">{row.value}</span>
                </div>
              ))}

              {client.services.length > 0 && (
                <div className="border-t border-subtle pt-3">
                  <p className="mb-1.5 text-overline uppercase text-tertiary">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {client.services.map((service) => (
                      <Badge key={service} tone="brand">
                        {titleCase(service)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Projects', value: client.counts.projects },
                { label: 'Invoices', value: client.counts.invoices },
                { label: 'Tickets', value: client.counts.tickets },
              ].map((item) => (
                <div key={item.label}>
                  <p className="metric text-heading-md text-primary">{item.value}</p>
                  <p className="text-caption text-tertiary">{item.label}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          {client.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-2.5">
                  {client.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-2.5">
                      <Avatar name={contact.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-primary">
                          {contact.name}
                        </p>
                        <p className="truncate text-caption text-tertiary">
                          {contact.designation ?? contact.email ?? '—'}
                        </p>
                      </div>
                      {contact.isPrimary && <Badge tone="brand">Primary</Badge>}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {fieldDefs.length > 0 && (
            <CustomFieldsCard
              clientId={client.id}
              definitions={fieldDefs}
              values={client.customFields}
              canEdit={canAny(PERMISSIONS.CLIENT_UPDATE)}
              onSaved={(updated) => setClient((prev) => (prev ? { ...prev, customFields: updated } : prev))}
            />
          )}
        </div>
      </div>
    </>
  );
}

function CustomFieldsCard({
  clientId,
  definitions,
  values,
  canEdit,
  onSaved,
}: {
  clientId: string;
  definitions: CustomFieldDefinition[];
  values: Record<string, unknown>;
  canEdit: boolean;
  onSaved: (values: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(values);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Client>(`/clients/${clientId}`, { customFields: draft });
      onSaved(updated.customFields);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save custom fields');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Custom fields</CardTitle>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={startEdit}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-3">
        {definitions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((definition) => {
            const value = editing ? draft[definition.key] : values[definition.key];
            if (!editing) {
              return (
                <div key={definition.id} className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-secondary">{definition.label}</span>
                  <span className="text-body-sm font-medium text-primary">
                    {value === undefined || value === null || value === '' ? '—' : String(value)}
                  </span>
                </div>
              );
            }
            return (
              <Field key={definition.id} label={definition.label + (definition.required ? ' *' : '')}>
                {definition.fieldType === 'BOOLEAN' ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => setDraft((prev) => ({ ...prev, [definition.key]: event.target.checked }))}
                      className="h-4 w-4 rounded border-subtle accent-brand-500"
                    />
                  </label>
                ) : definition.fieldType === 'SELECT' ? (
                  <Select
                    value={String(value ?? '')}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [definition.key]: event.target.value }))}
                  >
                    <option value="">—</option>
                    {definition.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={definition.fieldType === 'NUMBER' ? 'number' : definition.fieldType === 'DATE' ? 'date' : 'text'}
                    value={String(value ?? '')}
                    onChange={(event) => setDraft((prev) => ({ ...prev, [definition.key]: event.target.value }))}
                  />
                )}
              </Field>
            );
          })}

        {error && <p className="text-body-sm text-danger">{error}</p>}

        {editing && (
          <div className="flex justify-end gap-2 border-t border-subtle pt-3">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} loading={saving}>
              Save
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
