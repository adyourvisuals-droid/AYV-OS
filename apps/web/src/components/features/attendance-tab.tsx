'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Clock, LogIn, LogOut, Pencil } from 'lucide-react';

import { Avatar, Badge, Button, Card, CardBody, EmptyState, Field, Input, Modal, Select, Skeleton } from '@/components/ui';
import { MetricCard } from '@/components/features/metric-card';
import { api, ApiError } from '@/lib/api';
import { cn, titleCase } from '@/lib/utils';

interface BoardPerson {
  user: { id: string; name: string; avatarUrl: string | null; designation: string | null; department: string | null };
  state: 'in' | 'out' | 'leave' | 'absent';
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string | null;
  lateMinutes: number | null;
  minutes: number | null;
}

interface Board {
  date: string;
  summary: { total: number; in: number; out: number; leave: number; absent: number; late: number };
  people: BoardPerson[];
}

interface TimesheetDay {
  id: string;
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workMinutes: number | null;
  lateMinutes: number | null;
}

interface Summary {
  period: { month: number; year: number };
  totals: { presentDays: number; lateDays: number; leaveDays: number; totalMinutes: number; avgMinutes: number };
  days: TimesheetDay[];
}

interface TodayRecord {
  id: string;
  checkInAt: string | null;
  checkOutAt: string | null;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2000, i, 1), 'MMMM') }));

const STATE_META: Record<BoardPerson['state'], { label: string; dot: string; tone: 'success' | 'neutral' | 'info' | 'danger' }> = {
  in: { label: 'In', dot: 'bg-success', tone: 'success' },
  out: { label: 'Done', dot: 'bg-tertiary', tone: 'neutral' },
  leave: { label: 'Leave', dot: 'bg-info', tone: 'info' },
  absent: { label: 'Absent', dot: 'bg-danger', tone: 'danger' },
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  HALF_DAY: 'warning',
  WFH: 'info',
  LEAVE: 'info',
  HOLIDAY: 'neutral',
};

function fmtMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function fmtTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** The upgraded attendance experience: my clock, the live team board, and a monthly timesheet. */
export function AttendanceTab({ canManage }: { canManage: boolean }) {
  const now = new Date();
  const [board, setBoard] = useState<Board | null>(null);
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [personId, setPersonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<TimesheetDay | null>(null);

  const loadBoard = useCallback(async () => {
    const [boardData, todayData] = await Promise.all([
      api.get<Board>('/people/attendance/board').catch(() => null),
      api.get<TodayRecord | null>('/people/attendance/today').catch(() => null),
    ]);
    setBoard(boardData);
    setToday(todayData);
  }, []);

  const loadSheet = useCallback(async () => {
    const qs = new URLSearchParams({ month: String(month), year: String(year) });
    if (personId) qs.set('userId', personId);
    setSummary(await api.get<Summary>(`/people/attendance/summary?${qs}`).catch(() => null));
  }, [month, year, personId]);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadBoard(), loadSheet()]);
      setLoading(false);
    })();
  }, [loadBoard, loadSheet]);

  const clock = async (action: 'checkin' | 'checkout') => {
    setChecking(true);
    setError(null);
    try {
      await api.post(`/people/attendance/${action}`);
      await Promise.all([loadBoard(), loadSheet()]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Could not ${action}`);
    } finally {
      setChecking(false);
    }
  };

  const orderedPeople = useMemo(() => {
    const rank = { in: 0, absent: 1, leave: 2, out: 3 };
    return board ? [...board.people].sort((a, b) => rank[a.state] - rank[b.state]) : [];
  }, [board]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const checkedIn = Boolean(today?.checkInAt);
  const checkedOut = Boolean(today?.checkOutAt);

  return (
    <div className="space-y-5">
      {error && <p className="text-body-sm text-danger">{error}</p>}

      {/* My clock */}
      <Card className="overflow-hidden">
        <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                checkedIn && !checkedOut ? 'bg-success/15 text-success' : 'bg-sunken text-tertiary',
              )}
            >
              <Clock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-body-md font-medium text-primary">
                {!checkedIn ? 'You are not clocked in' : checkedOut ? 'Shift complete' : 'You are clocked in'}
              </p>
              <p className="text-caption text-tertiary">
                {checkedIn
                  ? `In ${fmtTime(today!.checkInAt)}${checkedOut ? ` · out ${fmtTime(today!.checkOutAt)}` : ''}`
                  : 'Clock in to start your day'}
              </p>
            </div>
          </div>
          <div>
            {!checkedIn && (
              <Button size="sm" onClick={() => void clock('checkin')} loading={checking}>
                <LogIn className="h-4 w-4" aria-hidden />
                Check in
              </Button>
            )}
            {checkedIn && !checkedOut && (
              <Button size="sm" variant="secondary" onClick={() => void clock('checkout')} loading={checking}>
                <LogOut className="h-4 w-4" aria-hidden />
                Check out
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Live board summary */}
      {board && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="In now" value={String(board.summary.in)} tone="success" />
          <MetricCard label="Checked out" value={String(board.summary.out)} />
          <MetricCard label="On leave" value={String(board.summary.leave)} />
          <MetricCard
            label="Absent"
            value={String(board.summary.absent)}
            tone={board.summary.absent > 0 ? 'warning' : 'neutral'}
          />
        </div>
      )}

      {/* Who's in now */}
      {board && board.people.length > 0 && (
        <Card>
          <CardBody className="pt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-body-md font-medium text-primary">Who&apos;s in now</p>
              <span className="text-caption text-tertiary">
                {board.summary.late > 0 && `${board.summary.late} late · `}
                {board.summary.total} people
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {orderedPeople.map((person) => {
                const meta = STATE_META[person.state];
                return (
                  <div
                    key={person.user.id}
                    className="flex items-center gap-3 rounded-lg border border-subtle p-2.5"
                  >
                    <div className="relative">
                      <Avatar name={person.user.name} src={person.user.avatarUrl} size="md" />
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface',
                          meta.dot,
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-primary">{person.user.name}</p>
                      <p className="truncate text-caption text-tertiary">
                        {person.state === 'in' || person.state === 'out'
                          ? `${fmtTime(person.checkInAt)} · ${fmtMinutes(person.minutes)}`
                          : person.user.designation || meta.label}
                      </p>
                    </div>
                    <Badge tone={person.lateMinutes ? 'warning' : meta.tone}>
                      {person.lateMinutes ? 'Late' : meta.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Monthly timesheet */}
      <Card>
        <CardBody className="pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-md font-medium text-primary">Timesheet</p>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && board && (
                <Select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-40">
                  <option value="">My timesheet</option>
                  {board.people.map((person) => (
                    <option key={person.user.id} value={person.user.id}>
                      {person.user.name}
                    </option>
                  ))}
                </Select>
              )}
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {summary && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Present', value: `${summary.totals.presentDays} days` },
                { label: 'Late', value: `${summary.totals.lateDays} days` },
                { label: 'Total hours', value: fmtMinutes(summary.totals.totalMinutes) },
                { label: 'Avg / day', value: fmtMinutes(summary.totals.avgMinutes) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-subtle bg-sunken/40 px-3 py-2">
                  <p className="text-overline uppercase text-tertiary">{stat.label}</p>
                  <p className="metric mt-0.5 text-heading-sm font-semibold text-primary">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {!summary || summary.days.length === 0 ? (
            <EmptyState icon={<Clock className="h-6 w-6" aria-hidden />} title="No attendance this month" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="py-2 pr-2 font-semibold">Date</th>
                    <th className="py-2 pr-2 font-semibold">Status</th>
                    <th className="py-2 pr-2 font-semibold">In</th>
                    <th className="py-2 pr-2 font-semibold">Out</th>
                    <th className="py-2 pr-2 text-right font-semibold">Hours</th>
                    {canManage && <th className="py-2 text-right font-semibold">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {summary.days.map((day) => (
                    <tr key={day.id} className="transition-colors hover:bg-sunken/50">
                      <td className="py-2.5 pr-2 text-body-sm text-primary">
                        {new Date(day.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-2.5 pr-2">
                        <Badge tone={STATUS_TONE[day.status] ?? 'neutral'}>{titleCase(day.status)}</Badge>
                      </td>
                      <td className="py-2.5 pr-2 text-body-sm text-secondary">{fmtTime(day.checkInAt)}</td>
                      <td className="py-2.5 pr-2 text-body-sm text-secondary">{fmtTime(day.checkOutAt)}</td>
                      <td className="metric py-2.5 pr-2 text-right text-body-sm text-secondary">
                        {fmtMinutes(day.workMinutes)}
                      </td>
                      {canManage && (
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setEditRow(day)}
                            className="rounded p-1 text-tertiary transition-colors hover:bg-sunken hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {canManage && editRow && (
        <EditAttendanceModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={async () => {
            setEditRow(null);
            await Promise.all([loadBoard(), loadSheet()]);
          }}
        />
      )}
    </div>
  );
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EDIT_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'WFH', 'LEAVE', 'HOLIDAY'];

function EditAttendanceModal({
  row,
  onClose,
  onSaved,
}: {
  row: TimesheetDay;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [checkIn, setCheckIn] = useState(toLocalInput(row.checkInAt));
  const [checkOut, setCheckOut] = useState(toLocalInput(row.checkOutAt));
  const [status, setStatus] = useState(row.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/people/attendance/${row.id}`, {
        checkInAt: checkIn ? new Date(checkIn).toISOString() : null,
        checkOutAt: checkOut ? new Date(checkOut).toISOString() : null,
        status,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit attendance">
      <div className="space-y-4">
        <p className="text-body-sm text-secondary">
          {new Date(row.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check in">
            <Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check out">
            <Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {EDIT_STATUSES.map((option) => (
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
          <Button onClick={() => void submit()} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
