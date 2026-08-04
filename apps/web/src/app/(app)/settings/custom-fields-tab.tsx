'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListPlus, Plus } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, titleCase } from '@/lib/utils';

interface FieldDefinition {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  position: number;
}

const ENTITY_TYPES = ['LEAD', 'CLIENT', 'PROJECT', 'TASK'];
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'];

export function CustomFieldsTab() {
  const { can } = useAuth();
  const [entityType, setEntityType] = useState('CLIENT');
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<FieldDefinition | null>(null);

  const canManage = can(PERMISSIONS.CUSTOM_FIELD_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDefinitions(await api.get<FieldDefinition[]>(`/settings/custom-fields?entityType=${entityType}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load custom fields');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const removeField = async (definition: FieldDefinition) => {
    if (!window.confirm(`Delete the "${definition.label}" field? Existing values will be orphaned.`)) return;
    try {
      await api.delete(`/settings/custom-fields/${definition.id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete the field');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setEntityType(type)}
              className={cn(
                'rounded-full border px-3 py-1 text-body-sm font-medium transition-colors',
                entityType === type
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-subtle text-secondary hover:bg-sunken',
              )}
            >
              {titleCase(type)}
            </button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New field
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : error && definitions.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : definitions.length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" aria-hidden />}
          title={`No custom fields on ${titleCase(entityType)} yet`}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Label</th>
                  <th className="px-4 py-2.5 font-semibold">Key</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Required</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {definitions
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((definition) => (
                    <tr key={definition.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-3 text-body-sm font-medium text-primary">{definition.label}</td>
                      <td className="px-4 py-3">
                        <code className="text-caption text-tertiary">{definition.key}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{titleCase(definition.fieldType)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-body-sm text-secondary">{definition.required ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        {canManage && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => setEditing(definition)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => void removeField(definition)}>
                              Delete
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FieldModal
        open={showCreate}
        entityType={entityType}
        definition={null}
        onClose={() => setShowCreate(false)}
        onSaved={async () => {
          setShowCreate(false);
          await load();
        }}
      />
      <FieldModal
        open={Boolean(editing)}
        entityType={entityType}
        definition={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function FieldModal({
  open,
  entityType,
  definition,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityType: string;
  definition: FieldDefinition | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState('TEXT');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (definition) {
      setKey(definition.key);
      setLabel(definition.label);
      setFieldType(definition.fieldType);
      setOptions(definition.options.join(', '));
      setRequired(definition.required);
    } else {
      setKey('');
      setLabel('');
      setFieldType('TEXT');
      setOptions('');
      setRequired(false);
    }
    setError(null);
  }, [open, definition]);

  const submit = async () => {
    if (!label.trim() || (!definition && !key.trim())) {
      setError('Key and label are required');
      return;
    }
    const optionList = options
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
    if (fieldType === 'SELECT' && optionList.length === 0) {
      setError('SELECT fields need at least one option');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (definition) {
        await api.patch(`/settings/custom-fields/${definition.id}`, {
          label,
          fieldType,
          options: optionList,
          required,
        });
      } else {
        await api.post('/settings/custom-fields', {
          entityType,
          key,
          label,
          fieldType,
          options: optionList,
          required,
        });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the field');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={definition ? 'Edit field' : `New field on ${titleCase(entityType)}`}>
      <div className="space-y-4">
        <Field label="Key">
          <Input
            value={key}
            disabled={Boolean(definition)}
            onChange={(event) => setKey(event.target.value)}
            placeholder="referral_source"
          />
        </Field>
        <Field label="Label">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Referral source" />
        </Field>
        <Field label="Type">
          <Select value={fieldType} onChange={(event) => setFieldType(event.target.value)}>
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </Select>
        </Field>
        {fieldType === 'SELECT' && (
          <Field label="Options (comma-separated)">
            <Input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="A, B, C" />
          </Field>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
            className="h-4 w-4 rounded border-subtle accent-brand-500"
          />
          <span className="text-body-sm text-secondary">Required</span>
        </label>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {definition ? 'Save changes' : 'Create field'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
