'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, LogIn, LogOut, Plus, Users } from 'lucide-react';

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
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Progress,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, titleCase } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
  designation: string | null;
  department: string | null;
  status: string;
  joinedAt: string | null;
  role: { id: string; key: string; name: string };
  manager: { id: string; name: string } | null;
}

interface Attendance {
  id: string;
  user: { id: string; name: string; avatarUrl: string | null };
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  workMinutes: number | null;
  lateMinutes: number | null;
}

interface Leave {
  id: string;
  user: { id: string; name: string; avatarUrl: string | null };
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  approver: { id: string; name: string } | null;
  decidedAt: string | null;
}

interface LeaveBalance {
  type: string;
  entitled: number;
  used: number;
  remaining: number;
}

const ATTENDANCE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  HALF_DAY: 'warning',
  WFH: 'info',
  LEAVE: 'neutral',
  HOLIDAY: 'neutral',
};

const LEAVE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function PeoplePage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'team' | 'attendance' | 'leave'>('team');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showRequestLeave, setShowRequestLeave] = useState(false);

  const canApproveLeave = can(PERMISSIONS.LEAVE_APPROVE);

  const load = useCallback(async () => {
    setError(null);
    try {
      // `todayRecord` comes from a dedicated endpoint, not from matching the
      // list client-side: the server owns which calendar day "today" is (in
      // the org timezone), so the check-in/out state never depends on a
      // timezone-fragile date comparison in the browser.
      const [employeeData, attendanceData, todayData, leaveData, balanceData] = await Promise.all([
        api.get<Employee[]>('/people/employees?limit=100'),
        api.get<Attendance[]>('/people/attendance?limit=100'),
        api.get<Attendance | null>('/people/attendance/today'),
        api.get<Leave[]>('/people/leave?limit=100'),
        api.get<LeaveBalance[]>('/people/leave/balances'),
      ]);
      setEmployees(employeeData);
      setAttendance(attendanceData);
      setTodayRecord(todayData);
      setLeaves(leaveData);
      setBalances(balanceData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load people data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkIn = async () => {
    setChecking(true);
    try {
      const record = await api.post<Attendance>('/people/attendance/checkin');
      setTodayRecord(record);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not check in');
    } finally {
      setChecking(false);
    }
  };

  const checkOut = async () => {
    setChecking(true);
    try {
      const record = await api.post<Attendance>('/people/attendance/checkout');
      setTodayRecord(record);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not check out');
    } finally {
      setChecking(false);
    }
  };

  const decideLeave = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/people/leave/${id}/decide`, { approved });
      await load();
    } catch {
      // The table reloads on the next successful action.
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

  if (error && employees.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const pendingLeaves = leaves.filter((leave) => leave.status === 'PENDING');

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${employees.length} team member(s)${pendingLeaves.length > 0 ? ` · ${pendingLeaves.length} leave request(s) pending` : ''}`}
        actions={
          tab === 'leave' ? (
            <Button size="sm" onClick={() => setShowRequestLeave(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Request leave
            </Button>
          ) : undefined
        }
      />

      <Tabs
        tabs={[
          { key: 'team', label: `Team (${employees.length})` },
          { key: 'attendance', label: 'Attendance' },
          { key: 'leave', label: `Leave${pendingLeaves.length > 0 ? ` (${pendingLeaves.length})` : ''}` },
        ]}
        active={tab}
        onChange={(key) => setTab(key as typeof tab)}
      />

      <div className="p-6">
        {error && <p className="mb-4 text-body-sm text-danger">{error}</p>}

        {tab === 'team' &&
          (employees.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" aria-hidden />} title="No team members yet" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((employee) => (
                <Card key={employee.id}>
                  <CardBody className="flex items-start gap-3 pt-5">
                    <Avatar name={employee.name} src={employee.avatarUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md font-medium text-primary">{employee.name}</p>
                      <p className="truncate text-caption text-tertiary">
                        {employee.designation ?? titleCase(employee.role.name)}
                      </p>
                      {employee.department && (
                        <Badge className="mt-1.5" tone="neutral">
                          {employee.department}
                        </Badge>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ))}

        {tab === 'attendance' && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-overline uppercase text-tertiary">Today</p>
                  {todayRecord?.checkInAt ? (
                    <p className="mt-1 text-body-sm text-secondary">
                      Checked in {formatTime(todayRecord.checkInAt)}
                      {todayRecord.checkOutAt && ` · checked out ${formatTime(todayRecord.checkOutAt)}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-body-sm text-secondary">Not checked in yet</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!todayRecord?.checkInAt && (
                    <Button size="sm" onClick={() => void checkIn()} loading={checking}>
                      <LogIn className="h-4 w-4" aria-hidden />
                      Check in
                    </Button>
                  )}
                  {todayRecord?.checkInAt && !todayRecord?.checkOutAt && (
                    <Button size="sm" variant="secondary" onClick={() => void checkOut()} loading={checking}>
                      <LogOut className="h-4 w-4" aria-hidden />
                      Check out
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {attendance.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" aria-hidden />}
                title="No attendance recorded this month"
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                        <th className="px-4 py-2.5 font-semibold">Person</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Check in</th>
                        <th className="px-4 py-2.5 font-semibold">Check out</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {attendance.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-sunken/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={row.user.name} src={row.user.avatarUrl} size="xs" />
                              <span className="text-body-sm text-secondary">{row.user.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-body-sm text-secondary">{formatDate(row.date)}</td>
                          <td className="px-4 py-3">
                            <Badge tone={ATTENDANCE_TONE[row.status] ?? 'neutral'}>{titleCase(row.status)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-body-sm text-secondary">
                            {row.checkInAt
                              ? new Date(row.checkInAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-body-sm text-secondary">
                            {row.checkOutAt
                              ? new Date(row.checkOutAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="metric px-4 py-3 text-right text-body-sm text-secondary">
                            {formatMinutes(row.workMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'leave' && (
          <div className="space-y-4">
            {balances.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {balances.map((balance) => (
                  <Card key={balance.type} className="p-4">
                    <p className="text-overline uppercase text-tertiary">{titleCase(balance.type)}</p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="metric text-heading-md text-primary">{balance.remaining}</span>
                      <span className="text-caption text-tertiary">/ {balance.entitled} days left</span>
                    </p>
                    <Progress
                      className="mt-2"
                      value={balance.entitled > 0 ? (balance.used / balance.entitled) * 100 : 0}
                      tone={balance.remaining <= 2 ? 'danger' : 'brand'}
                    />
                  </Card>
                ))}
              </div>
            )}

            {leaves.length === 0 ? (
              <EmptyState icon={<CalendarClock className="h-6 w-6" aria-hidden />} title="No leave requests yet" />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                        <th className="px-4 py-2.5 font-semibold">Person</th>
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Dates</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Days</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="transition-colors hover:bg-sunken/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={leave.user.name} src={leave.user.avatarUrl} size="xs" />
                              <span className="text-body-sm text-secondary">{leave.user.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-body-sm text-secondary">{titleCase(leave.type)}</td>
                          <td className="px-4 py-3 text-body-sm text-secondary">
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                          </td>
                          <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{leave.days}</td>
                          <td className="px-4 py-3">
                            <Badge tone={LEAVE_TONE[leave.status] ?? 'neutral'}>{titleCase(leave.status)}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {leave.status === 'PENDING' && canApproveLeave && (
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="secondary" onClick={() => void decideLeave(leave.id, true)}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => void decideLeave(leave.id, false)}>
                                  Reject
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
          </div>
        )}
      </div>

      <RequestLeaveModal
        open={showRequestLeave}
        onClose={() => setShowRequestLeave(false)}
        onCreated={async () => {
          setShowRequestLeave(false);
          await load();
        }}
      />
    </>
  );
}

function RequestLeaveModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType('CASUAL');
      setStartDate('');
      setEndDate('');
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/people/leave', { type, startDate, endDate, reason: reason || undefined });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit the leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Request leave">
      <div className="space-y-4">
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            {['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'MATERNITY', 'PATERNITY', 'COMP_OFF'].map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Reason (optional)">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Submit request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
