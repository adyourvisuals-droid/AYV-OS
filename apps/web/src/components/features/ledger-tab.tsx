'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { MetricCard } from '@/components/features/metric-card';
import {
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
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface LedgerEntry {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  date: string;
  note: string | null;
  createdBy: { id: string; name: string } | null;
}

const INCOME_CATEGORIES = ['Client payment', 'Reimbursement', 'Other income'];
const EXPENSE_CATEGORIES = ['Petty cash', 'Travel', 'Office supplies', 'Food', 'Courier', 'Miscellaneous'];

export function LedgerTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.LEDGER_MANAGE);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      setEntries(await api.get<LedgerEntry[]>(`/finance/ledger?from=${from}&to=${to}&limit=500`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the daily ledger');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const income = entries.filter((e) => e.type === 'INCOME').reduce((sum, e) => sum + e.amount, 0);
    const expense = entries.filter((e) => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [entries]);

  const remove = async (id: string) => {
    try {
      await api.delete(`/finance/ledger/${id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove this entry');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1)))} aria-label="Previous month">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <p className="w-40 text-center text-body-md font-medium text-primary">{format(month, 'MMMM yyyy')}</p>
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1)))} aria-label="Next month">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New entry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Income" value={formatCurrency(totals.income, { compact: true })} tone="success" />
        <MetricCard label="Expenses" value={formatCurrency(totals.expense, { compact: true })} tone="warning" />
        <MetricCard
          label="Net balance"
          value={formatCurrency(totals.balance, { compact: true })}
          tone={totals.balance >= 0 ? 'success' : 'danger'}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : entries.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" aria-hidden />} title="No entries this month" description="Log daily income or expenses to track cash flow here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Note</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-sunken/60">
                    <td className="px-4 py-3 text-body-sm text-secondary">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-body-sm text-primary">
                        {entry.type === 'INCOME' ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-danger" aria-hidden />
                        )}
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-secondary">{entry.note ?? '—'}</td>
                    <td
                      className={`metric px-4 py-3 text-right text-body-sm font-medium ${
                        entry.type === 'INCOME' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {entry.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void remove(entry.id)}
                          className="rounded p-1 text-tertiary transition-colors hover:bg-danger-bg hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewLedgerEntryModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={async () => {
          setShowNew(false);
          await load();
        }}
      />
    </div>
  );
}

function NewLedgerEntryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('EXPENSE');
    setCategory(EXPENSE_CATEGORIES[0]);
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNote('');
    setError(null);
  }, [open]);

  const categories = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a positive amount');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/finance/ledger', { type, category, amount: value, date, note: note || undefined });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New ledger entry">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={type}
              onChange={(event) => {
                const next = event.target.value as 'INCOME' | 'EXPENSE';
                setType(next);
                setCategory(next === 'INCOME' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
              }}
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Save entry
          </Button>
        </div>
      </div>
    </Modal>
  );
}
