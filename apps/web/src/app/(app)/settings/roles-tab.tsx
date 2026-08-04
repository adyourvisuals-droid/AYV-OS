'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Shield } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
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

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  level: number;
  userCount: number;
  permissionCount: number;
}

interface PermissionGroup {
  domain: string;
  permissions: { key: string; description: string | null }[];
}

interface Grant {
  permission: string;
  scope: 'ALL' | 'TEAM' | 'OWN';
}

interface RoleDetail extends Role {
  grants: Grant[];
}

export function RolesTab() {
  const { can } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [roleData, groupData] = await Promise.all([
        api.get<Role[]>('/settings/roles'),
        api.get<PermissionGroup[]>('/settings/permissions'),
      ]);
      setRoles(roleData);
      setGroups(groupData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeRole = async (role: Role) => {
    if (!window.confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    try {
      await api.delete(`/settings/roles/${role.id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete the role');
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (error && roles.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-secondary">
          {roles.length} role(s) · System roles are read-only — clone a custom role to customise.
        </p>
        {can(PERMISSIONS.ROLE_CREATE) && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New role
          </Button>
        )}
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      {roles.length === 0 ? (
        <EmptyState icon={<Shield className="h-6 w-6" aria-hidden />} title="No roles yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                  <th className="px-4 py-2.5 font-semibold">Key</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Level</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Users</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Permissions</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {roles
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((role) => (
                    <tr key={role.id} className="transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(role.id)}
                          className="text-left text-body-sm font-medium text-primary hover:text-brand-600 hover:underline"
                        >
                          {role.name}
                        </button>
                        {role.description && (
                          <p className="mt-0.5 max-w-md truncate text-caption text-tertiary">
                            {role.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-caption text-tertiary">{role.key}</code>
                          {role.isSystem && <Badge tone="neutral">System</Badge>}
                        </div>
                      </td>
                      <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{role.level}</td>
                      <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{role.userCount}</td>
                      <td className="metric px-4 py-3 text-right text-body-sm text-secondary">
                        {role.permissionCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setEditingId(role.id)}>
                            {role.isSystem ? 'View' : 'Edit'}
                          </Button>
                          {!role.isSystem && role.userCount === 0 && can(PERMISSIONS.ROLE_DELETE) && (
                            <Button size="sm" variant="danger" onClick={() => void removeRole(role)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateRoleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await load();
        }}
      />

      <EditRoleModal
        roleId={editingId}
        groups={groups}
        onClose={() => setEditingId(null)}
        onSaved={async () => {
          setEditingId(null);
          await load();
        }}
      />
    </div>
  );
}

function CreateRoleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKey('');
      setName('');
      setDescription('');
      setLevel('100');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !key.trim()) {
      setError('Key and name are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/settings/roles', {
        key,
        name,
        description: description || undefined,
        level: Number(level) || 100,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New role">
      <div className="space-y-4">
        <Field label="Key (e.g. REGIONAL_MANAGER)">
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="CUSTOM_ROLE" />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Regional Manager" />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Level (lower is more senior)">
          <Input type="number" value={level} onChange={(event) => setLevel(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create role
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditRoleModal({
  roleId,
  groups,
  onClose,
  onSaved,
}: {
  roleId: string | null;
  groups: PermissionGroup[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { can } = useAuth();
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [grants, setGrants] = useState<Map<string, 'ALL' | 'TEAM' | 'OWN'>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roleId) {
      setRole(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<RoleDetail>(`/settings/roles/${roleId}`)
      .then((detail) => {
        setRole(detail);
        setGrants(new Map(detail.grants.map((grant) => [grant.permission, grant.scope])));
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load role'))
      .finally(() => setLoading(false));
  }, [roleId]);

  if (!roleId) return null;

  const readOnly = role?.isSystem || !can(PERMISSIONS.ROLE_UPDATE);

  const toggle = (permission: string) => {
    setGrants((prev) => {
      const next = new Map(prev);
      if (next.has(permission)) next.delete(permission);
      else next.set(permission, 'ALL');
      return next;
    });
  };

  const setScope = (permission: string, scope: 'ALL' | 'TEAM' | 'OWN') => {
    setGrants((prev) => new Map(prev).set(permission, scope));
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/settings/roles/${role.id}`, {
        grants: Array.from(grants.entries()).map(([permission, scope]) => ({ permission, scope })),
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(roleId)} onClose={onClose} title={role ? role.name : 'Role'} className="max-w-2xl">
      {loading || !role ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-4">
          {role.isSystem && (
            <p className="rounded-md bg-sunken px-3 py-2 text-caption text-tertiary">
              This is a system role and cannot be edited. Create a custom role to grant a different mix of
              permissions.
            </p>
          )}

          <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.domain}>
                <p className="mb-2 text-overline uppercase text-tertiary">{titleCase(group.domain)}</p>
                <div className="space-y-1.5">
                  {group.permissions.map((permission) => {
                    const scope = grants.get(permission.key);
                    const granted = scope !== undefined;
                    return (
                      <div key={permission.key} className="flex items-center justify-between gap-3 py-0.5">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={granted}
                            disabled={readOnly}
                            onChange={() => toggle(permission.key)}
                            className="h-4 w-4 shrink-0 rounded border-subtle accent-brand-500 disabled:opacity-50"
                          />
                          <span className="truncate text-body-sm text-secondary">
                            {permission.description ?? permission.key}
                          </span>
                        </label>
                        {granted && (
                          <Select
                            value={scope}
                            disabled={readOnly}
                            onChange={(event) => setScope(permission.key, event.target.value as 'ALL' | 'TEAM' | 'OWN')}
                            className="h-7 w-24 shrink-0 text-caption"
                          >
                            <option value="ALL">All</option>
                            <option value="TEAM">Team</option>
                            <option value="OWN">Own</option>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-body-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-subtle pt-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Close
            </Button>
            {!readOnly && (
              <Button onClick={() => void save()} loading={saving}>
                Save changes
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
