'use client';

import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, Zap } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
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
import { formatRelative, titleCase } from '@/lib/utils';
import { ACTION_TYPES, OPERATORS, TRIGGER_META } from '@/lib/trigger-meta';

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface RuleAction {
  type: string;
  params: Record<string, unknown>;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: string;
  triggerKey: string;
  conditions: Condition[];
  actions: RuleAction[];
  runCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface DryRunResult {
  matched: boolean;
  sample: Record<string, unknown> | null;
  message: string;
  actionsWouldRun: string[];
}

const TRIGGER_TYPES = ['EVENT', 'SCHEDULE', 'THRESHOLD', 'MANUAL', 'WEBHOOK'];

export function AutomationsTab() {
  const { can } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [dryRunFor, setDryRunFor] = useState<Rule | null>(null);

  const canManage = can(PERMISSIONS.AUTOMATION_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRules(await api.get<Rule[]>('/settings/automations'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (rule: Rule) => {
    try {
      await api.patch(`/settings/automations/${rule.id}`, { isActive: !rule.isActive });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the rule');
    }
  };

  const removeRule = async (rule: Rule) => {
    if (!window.confirm(`Delete the "${rule.name}" automation?`)) return;
    try {
      await api.delete(`/settings/automations/${rule.id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete the rule');
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (error && rules.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-secondary">
          {rules.length} rule(s) · Rules run in dry-run simulation only — no live actions are executed yet.
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New automation
          </Button>
        )}
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      {rules.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" aria-hidden />} title="No automation rules yet" />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle>{rule.name}</CardTitle>
                    <Badge tone={rule.isActive ? 'success' : 'neutral'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {rule.description && <p className="mt-1 text-body-sm text-secondary">{rule.description}</p>}
                  <p className="mt-1 text-caption text-tertiary">
                    Trigger: {titleCase(rule.triggerType)} · {rule.triggerKey} · {rule.runCount} run(s)
                    {rule.lastRunAt && ` · last ${formatRelative(rule.lastRunAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setDryRunFor(rule)}>
                    <Play className="h-3.5 w-3.5" aria-hidden />
                    Dry run
                  </Button>
                  {canManage && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => void toggleActive(rule)}>
                        {rule.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(rule)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void removeRule(rule)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              {rule.conditions.length > 0 && (
                <CardBody className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {rule.conditions.map((condition, index) => (
                      <Badge key={index} tone="neutral">
                        {condition.field} {condition.operator} {String(condition.value)}
                      </Badge>
                    ))}
                  </div>
                </CardBody>
              )}
            </Card>
          ))}
        </div>
      )}

      <RuleModal
        open={showCreate}
        rule={null}
        onClose={() => setShowCreate(false)}
        onSaved={async () => {
          setShowCreate(false);
          await load();
        }}
      />
      <RuleModal
        open={Boolean(editing)}
        rule={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />

      <DryRunModal rule={dryRunFor} onClose={() => setDryRunFor(null)} />
    </div>
  );
}

function emptyCondition(): Condition {
  return { field: '', operator: 'eq', value: '' };
}

function emptyAction(): RuleAction {
  return { type: 'CREATE_NOTIFICATION', params: {} };
}

function RuleModal({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: Rule | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('EVENT');
  const [triggerKey, setTriggerKey] = useState(TRIGGER_META[0].key as string);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([emptyAction()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setDescription(rule.description ?? '');
      setTriggerType(rule.triggerType);
      setTriggerKey(rule.triggerKey);
      setConditions(rule.conditions.length > 0 ? rule.conditions : []);
      setActions(rule.actions.length > 0 ? rule.actions : [emptyAction()]);
    } else {
      setName('');
      setDescription('');
      setTriggerType('EVENT');
      setTriggerKey(TRIGGER_META[0].key as string);
      setConditions([]);
      setActions([emptyAction()]);
    }
    setError(null);
  }, [open, rule]);

  const fields = TRIGGER_META.find((meta) => meta.key === triggerKey)?.fields ?? [];

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    const cleanedConditions = conditions.filter((condition) => condition.field);
    const cleanedActions = actions.filter((action) => action.type);
    try {
      if (rule) {
        await api.patch(`/settings/automations/${rule.id}`, {
          name,
          description: description || undefined,
          conditions: cleanedConditions,
          actions: cleanedActions,
        });
      } else {
        await api.post('/settings/automations', {
          name,
          description: description || undefined,
          triggerType,
          triggerKey: triggerType === 'EVENT' ? triggerKey : name.toUpperCase().replace(/\s+/g, '_'),
          conditions: cleanedConditions,
          actions: cleanedActions,
        });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the automation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={rule ? 'Edit automation' : 'New automation'} className="max-w-xl">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Notify on hot lead" />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        {!rule && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger type">
              <Select value={triggerType} onChange={(event) => setTriggerType(event.target.value)}>
                {TRIGGER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {titleCase(type)}
                  </option>
                ))}
              </Select>
            </Field>
            {triggerType === 'EVENT' && (
              <Field label="Trigger event">
                <Select value={triggerKey} onChange={(event) => setTriggerKey(event.target.value)}>
                  {TRIGGER_META.map((meta) => (
                    <option key={meta.key} value={meta.key}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption font-medium text-secondary">Conditions (all must match)</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <Select
                  value={condition.field}
                  onChange={(event) =>
                    setConditions((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, field: event.target.value } : c)),
                    )
                  }
                  className="flex-1"
                >
                  <option value="">Field…</option>
                  {fields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </Select>
                <Select
                  value={condition.operator}
                  onChange={(event) =>
                    setConditions((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, operator: event.target.value } : c)),
                    )
                  }
                  className="w-36"
                >
                  {OPERATORS.map((operator) => (
                    <option key={operator.key} value={operator.key}>
                      {operator.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={condition.value}
                  onChange={(event) =>
                    setConditions((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, value: event.target.value } : c)),
                    )
                  }
                  placeholder="Value"
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption font-medium text-secondary">Actions</span>
            <Button size="sm" variant="ghost" onClick={() => setActions((prev) => [...prev, emptyAction()])}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div key={index} className="space-y-1.5 rounded-md border border-subtle p-2.5">
                <div className="flex items-center gap-1.5">
                  <Select
                    value={action.type}
                    onChange={(event) =>
                      setActions((prev) =>
                        prev.map((a, i) => (i === index ? { type: event.target.value, params: {} } : a)),
                      )
                    }
                    className="flex-1"
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type.key} value={type.key}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setActions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                </div>
                <ActionParams
                  action={action}
                  onChange={(params) =>
                    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, params } : a)))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-subtle pt-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {rule ? 'Save changes' : 'Create automation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ActionParams({
  action,
  onChange,
}: {
  action: RuleAction;
  onChange: (params: Record<string, unknown>) => void;
}) {
  if (action.type === 'CREATE_NOTIFICATION') {
    return (
      <Input
        placeholder="Notification message"
        value={String(action.params.message ?? '')}
        onChange={(event) => onChange({ message: event.target.value })}
      />
    );
  }
  if (action.type === 'CREATE_TASK') {
    return (
      <Input
        placeholder="Task title"
        value={String(action.params.title ?? '')}
        onChange={(event) => onChange({ title: event.target.value })}
      />
    );
  }
  return (
    <div className="flex gap-1.5">
      <Input
        placeholder="Field"
        value={String(action.params.field ?? '')}
        onChange={(event) => onChange({ ...action.params, field: event.target.value })}
      />
      <Input
        placeholder="Value"
        value={String(action.params.value ?? '')}
        onChange={(event) => onChange({ ...action.params, value: event.target.value })}
      />
    </div>
  );
}

function DryRunModal({ rule, onClose }: { rule: Rule | null; onClose: () => void }) {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rule) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .post<DryRunResult>(`/settings/automations/${rule.id}/dry-run`)
      .then(setResult)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not run the simulation'))
      .finally(() => setLoading(false));
  }, [rule]);

  return (
    <Modal open={Boolean(rule)} onClose={onClose} title={`Dry run: ${rule?.name ?? ''}`}>
      {loading ? (
        <Skeleton className="h-32" />
      ) : error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : result ? (
        <div className="space-y-3">
          <Badge tone={result.matched ? 'success' : 'neutral'}>
            {result.matched ? 'Conditions matched' : 'Did not match'}
          </Badge>
          <p className="text-body-sm text-secondary">{result.message}</p>
          {result.sample && (
            <pre className="overflow-x-auto rounded-md bg-sunken p-3 text-caption text-secondary">
              {JSON.stringify(result.sample, null, 2)}
            </pre>
          )}
          {result.actionsWouldRun.length > 0 && (
            <div>
              <p className="mb-1.5 text-overline uppercase text-tertiary">Would run</p>
              <ul className="space-y-1">
                {result.actionsWouldRun.map((description, index) => (
                  <li key={index} className="text-body-sm text-secondary">
                    · {description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
