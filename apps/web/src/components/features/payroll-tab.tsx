'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Banknote, Play } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { MetricCard } from '@/components/features/metric-card';
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
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

interface Payroll {
  id: string;
  user: { id: string; name: string; designation: string | null };
  month: number;
  year: number;
  basic: number;
  allowances: number;
  deductions: number;
  bonus: number;
  netPay: number;
  currency: string;
  presentDays: number | null;
  status: string;
  paidAt: string | null;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'neutral',
  APPROVED: 'info',
  PAID: 'success',
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2000, i, 1), 'MMMM'),
}));

export function PayrollTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Payroll | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.get<Payroll[]>(`/people/payroll?month=${month}&year=${year}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load payroll');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const net = rows.reduce((sum, row) => sum + row.netPay, 0);
    const paid = rows.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + row.netPay, 0);
    return { net, paid, count: rows.length };
  }, [rows]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.post('/people/payroll/generate', { month, year });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (row: Payroll, status: string) => {
    try {
      await api.patch(`/people/payroll/${row.id}`, { status });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update payroll');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <Field label="Month">
            <Select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="w-36">
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year">
            <Select value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-24">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => void generate()} loading={generating}>
            <Play className="h-4 w-4" aria-hidden />
            Generate payroll
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Employees" value={String(totals.count)} />
        <MetricCard label="Total net pay" value={formatCurrency(totals.net, { compact: true })} />
        <MetricCard label="Paid out" value={formatCurrency(totals.paid, { compact: true })} tone="success" />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-6 w-6" aria-hidden />}
          title="No payroll for this month"
          description={canManage ? 'Generate payroll to create draft payslips from employee salaries.' : 'Nothing has been generated yet.'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Employee</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Present</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Basic</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Allow.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Deduct.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Bonus</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net pay</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-sunken/60">
                    <td className="px-4 py-3">
                      <p className="text-body-sm font-medium text-primary">{row.user.name}</p>
                      {row.user.designation && <p className="text-caption text-tertiary">{row.user.designation}</p>}
                    </td>
                    <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{row.presentDays ?? '—'}</td>
                    <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{formatCurrency(row.basic)}</td>
                    <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{formatCurrency(row.allowances)}</td>
                    <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{formatCurrency(row.deductions)}</td>
                    <td className="metric px-4 py-3 text-right text-body-sm text-secondary">{formatCurrency(row.bonus)}</td>
                    <td className="metric px-4 py-3 text-right text-body-sm font-semibold text-primary">{formatCurrency(row.netPay)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex justify-end gap-1.5">
                          {row.status === 'DRAFT' && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
                                Edit
                              </Button>
                              <Button size="sm" onClick={() => void setStatus(row, 'APPROVED')}>
                                Approve
                              </Button>
                            </>
                          )}
                          {row.status === 'APPROVED' && (
                            <Button size="sm" onClick={() => void setStatus(row, 'PAID')}>
                              Mark paid
                            </Button>
                          )}
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

      <EditPayrollModal
        payroll={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function EditPayrollModal({
  payroll,
  onClose,
  onSaved,
}: {
  payroll: Payroll | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [basic, setBasic] = useState('0');
  const [allowances, setAllowances] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [bonus, setBonus] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payroll) return;
    setBasic(String(payroll.basic));
    setAllowances(String(payroll.allowances));
    setDeductions(String(payroll.deductions));
    setBonus(String(payroll.bonus));
    setError(null);
  }, [payroll]);

  const net = Math.max(
    0,
    (Number(basic) || 0) + (Number(allowances) || 0) + (Number(bonus) || 0) - (Number(deductions) || 0),
  );

  const submit = async () => {
    if (!payroll) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/people/payroll/${payroll.id}`, {
        basic: Number(basic) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        bonus: Number(bonus) || 0,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save payroll');
    } finally {
      setSubmitting(false);
    }
  };

  if (!payroll) return null;

  return (
    <Modal open={Boolean(payroll)} onClose={onClose} title={`Edit payslip — ${payroll.user.name}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Basic (₹)">
            <Input type="number" min="0" value={basic} onChange={(event) => setBasic(event.target.value)} />
          </Field>
          <Field label="Allowances (₹)">
            <Input type="number" min="0" value={allowances} onChange={(event) => setAllowances(event.target.value)} />
          </Field>
          <Field label="Deductions (₹)">
            <Input type="number" min="0" value={deductions} onChange={(event) => setDeductions(event.target.value)} />
          </Field>
          <Field label="Bonus (₹)">
            <Input type="number" min="0" value={bonus} onChange={(event) => setBonus(event.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-md border border-subtle bg-sunken/40 px-4 py-3">
          <span className="text-body-sm font-medium text-primary">Net pay</span>
          <span className="metric text-body-md font-semibold text-primary">{formatCurrency(net)}</span>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Save payslip
          </Button>
        </div>
      </div>
    </Modal>
  );
}
