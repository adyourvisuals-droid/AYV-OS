'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, Users } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import {
  Avatar,
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
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { titleCase } from '@/lib/utils';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
  designation: string | null;
  department: string | null;
  status: string;
  role: { id: string; key: string; name: string };
  manager: { id: string; name: string } | null;
}

interface Role {
  id: string;
  key: string;
  name: string;
  level: number;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'danger',
  OFFBOARDED: 'neutral',
};

export function TeamTab() {
  const { user, can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const myLevel = user?.role.level ?? 100;
  const canCreate = can(PERMISSIONS.USER_CREATE);
  const canUpdate = can(PERMISSIONS.USER_UPDATE);

  const load = useCallback(async () => {
    setError(null);
    try {
      // The member list is the point of this tab and every member already
      // carries its role name for display. The role catalogue is only needed
      // for the seniority checks and the role picker in the create/edit
      // modal — both edit-only — so a caller with USER_READ but not ROLE_READ
      // still sees the team instead of a 403 taking down the whole tab.
      const memberData = await api.get<Member[]>('/settings/users');
      setMembers(memberData);
      const roleData = await api.get<Role[]>('/settings/roles').catch(() => [] as Role[]);
      setRoles(roleData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-96" />;
  if (error && members.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  // A person may only be acted on by someone strictly more senior, which is
  // the same rule the API enforces — mirrored here so the UI does not offer
  // actions that would come back as a 403.
  const mayEdit = (member: Member) => {
    const level = roles.find((role) => role.id === member.role.id)?.level ?? 100;
    return canUpdate && (myLevel === 0 || level > myLevel);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-secondary">
          {members.length} member(s) · Roles set what someone can do; the reporting line sets whose work they see.
        </p>
        {canCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add member
          </Button>
        )}
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      {members.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" aria-hidden />} title="No team members yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Member</th>
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                  <th className="px-4 py-2.5 font-semibold">Reports to</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {members.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-sunken/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-body-sm font-medium text-primary">{member.name}</p>
                          <p className="truncate text-caption text-tertiary">
                            {member.designation ?? member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="brand">{member.role.name}</Badge>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-secondary">
                      {member.manager?.name ?? <span className="text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[member.status] ?? 'neutral'}>{titleCase(member.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {mayEdit(member) && (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateMemberModal
        open={showCreate}
        roles={roles}
        members={members}
        myLevel={myLevel}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await load();
        }}
      />

      <EditMemberModal
        member={editing}
        roles={roles}
        members={members}
        myLevel={myLevel}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

/** Only roles strictly less senior than the actor's may be granted. */
function assignableRoles(roles: Role[], myLevel: number): Role[] {
  return roles
    .filter((role) => role.key !== 'CLIENT')
    .filter((role) => myLevel === 0 || role.level > myLevel)
    .sort((a, b) => a.level - b.level);
}

function CreateMemberModal({
  open,
  roles,
  members,
  myLevel,
  onClose,
  onCreated,
}: {
  open: boolean;
  roles: Role[];
  members: Member[];
  myLevel: number;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [designation, setDesignation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; temporaryPassword: string } | null>(null);

  const options = assignableRoles(roles, myLevel);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRoleId(options[options.length - 1]?.id ?? '');
    setManagerId('');
    setDesignation('');
    setError(null);
    setCreated(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!name.trim() || !email.trim() || !roleId) {
      setError('Name, email and role are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ name: string; email: string; temporaryPassword: string }>(
        '/settings/users',
        {
          name,
          email,
          roleId,
          managerId: managerId || undefined,
          designation: designation || undefined,
        },
      );
      setCreated(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the member');
    } finally {
      setSubmitting(false);
    }
  };

  // Once created, the temporary password is shown once and cannot be
  // retrieved again — so the modal switches to a hand-off view rather than
  // closing straight away.
  if (created) {
    return (
      <Modal open={open} onClose={() => void onCreated()} title="Member added">
        <div className="space-y-4">
          <p className="text-body-sm text-secondary">
            <span className="font-medium text-primary">{created.name}</span> can now sign in with the
            credentials below. This password is shown only once — send it to them, and they should change it
            after signing in.
          </p>
          <div className="space-y-2 rounded-md border border-subtle bg-sunken p-3">
            <div>
              <p className="text-overline uppercase text-tertiary">Email</p>
              <p className="text-body-sm text-primary">{created.email}</p>
            </div>
            <div>
              <p className="text-overline uppercase text-tertiary">Temporary password</p>
              <div className="flex items-center gap-2">
                <code className="text-body-sm text-primary">{created.temporaryPassword}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(created.temporaryPassword)}
                  className="rounded p-1 text-tertiary transition-colors hover:bg-surface hover:text-primary"
                  aria-label="Copy password"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void onCreated()}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Add team member">
      <div className="space-y-4">
        <Field label="Full name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Asha Menon" />
        </Field>
        <Field label="Work email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="asha@adyourvision.com"
          />
        </Field>
        <Field label="Role">
          <Select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            {options.length === 0 && <option value="">No roles you can assign</option>}
            {options.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to (optional)">
          <Select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">No manager</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} — {member.role.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Designation (optional)">
          <Input
            value={designation}
            onChange={(event) => setDesignation(event.target.value)}
            placeholder="Senior Designer"
          />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Add member
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditMemberModal({
  member,
  roles,
  members,
  myLevel,
  onClose,
  onSaved,
}: {
  member: Member | null;
  roles: Role[];
  members: Member[];
  myLevel: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [roleId, setRoleId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [designation, setDesignation] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setRoleId(member.role.id);
    setManagerId(member.manager?.id ?? '');
    setDesignation(member.designation ?? '');
    setStatus(member.status);
    setError(null);
  }, [member]);

  if (!member) return null;

  const options = assignableRoles(roles, myLevel);
  // A person cannot report to themselves; the API also rejects deeper loops.
  const managerOptions = members.filter((candidate) => candidate.id !== member.id);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/settings/users/${member.id}`, {
        roleId,
        managerId: managerId || null,
        designation: designation || null,
        status,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(member)} onClose={onClose} title={member.name}>
      <div className="space-y-4">
        <Field label="Role">
          <Select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            {options.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to">
          <Select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">No manager</option>
            {managerOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} — {candidate.role.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Designation">
          <Input value={designation} onChange={(event) => setDesignation(event.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {['ACTIVE', 'INVITED', 'SUSPENDED', 'OFFBOARDED'].map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
