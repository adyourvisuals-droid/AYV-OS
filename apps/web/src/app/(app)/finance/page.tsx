'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Receipt, XCircle } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { LedgerTab } from '@/components/features/ledger-tab';
import { MetricCard } from '@/components/features/metric-card';
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
  Tabs,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface Summary {
  revenue: { value: number; previous: number };
  expenses: { value: number };
  profit: { value: number; margin: number };
  receivables: { total: number; overdue: number; overdueCount: number; collected: number };
  expensesByCategory: { category: string; amount: number }[];
  vendorCount: number;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  client: { id: string; name: string } | null;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  isOverdue: boolean;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  incurredAt: string;
  submittedBy: { id: string; name: string; avatarUrl: string | null } | null;
  vendor: { id: string; name: string } | null;
}

interface Vendor {
  id: string;
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

const INVOICE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

const EXPENSE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  REIMBURSED: 'info',
};

export default function FinancePage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'invoices' | 'expenses' | 'vendors' | 'ledger'>('invoices');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [showNewVendor, setShowNewVendor] = useState(false);

  const canManageInvoices = can(PERMISSIONS.INVOICE_CREATE);
  const canManageExpenses = can(PERMISSIONS.EXPENSE_CREATE);
  const canApproveExpenses = can(PERMISSIONS.EXPENSE_APPROVE);
  const canManageVendors = can(PERMISSIONS.VENDOR_MANAGE);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryData, invoiceData, expenseData, vendorData, clientData] = await Promise.all([
        api.get<Summary>('/finance/summary'),
        api.get<Invoice[]>('/finance/invoices?limit=100'),
        api.get<Expense[]>('/finance/expenses?limit=100'),
        canManageVendors ? api.get<Vendor[]>('/finance/vendors?limit=100') : Promise.resolve([]),
        api.get<ClientOption[]>('/clients?limit=100'),
      ]);
      setSummary(summaryData);
      setInvoices(invoiceData);
      setExpenses(expenseData);
      setVendors(vendorData);
      setClients(clientData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load finance data');
    } finally {
      setLoading(false);
    }
  }, [canManageVendors]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && canManageInvoices) setShowNewInvoice(true);
  }, [searchParams, canManageInvoices]);

  const approveExpense = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/finance/expenses/${id}/approve`, { approved });
      await load();
    } catch {
      // The table reloads on the next successful action.
    }
  };

  const markSent = async (id: string) => {
    try {
      await api.patch(`/finance/invoices/${id}/status`, { status: 'SENT' });
      await load();
    } catch {
      // no-op
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorState message={error ?? 'Could not load finance data'} onRetry={() => void load()} />;
  }

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle={`${formatCurrency(summary.profit.value, { compact: true })} profit this month · ${summary.profit.margin}% margin`}
        actions={
          <div className="flex items-center gap-2">
            {tab === 'invoices' && canManageInvoices && (
              <Button size="sm" onClick={() => setShowNewInvoice(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New invoice
              </Button>
            )}
            {tab === 'expenses' && canManageExpenses && (
              <Button size="sm" onClick={() => setShowNewExpense(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New expense
              </Button>
            )}
            {tab === 'vendors' && canManageVendors && (
              <Button size="sm" onClick={() => setShowNewVendor(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New vendor
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue (month)"
          value={formatCurrency(summary.revenue.value, { compact: true })}
          change={
            summary.revenue.previous > 0
              ? Number((((summary.revenue.value - summary.revenue.previous) / summary.revenue.previous) * 100).toFixed(1))
              : null
          }
        />
        <MetricCard
          label="Expenses (month)"
          value={formatCurrency(summary.expenses.value, { compact: true })}
          tone="warning"
        />
        <MetricCard
          label="Profit"
          value={formatCurrency(summary.profit.value, { compact: true })}
          caption={`${summary.profit.margin}% margin`}
          tone={summary.profit.value >= 0 ? 'success' : 'danger'}
        />
        <MetricCard
          label="Receivables"
          value={formatCurrency(summary.receivables.total, { compact: true })}
          caption={
            summary.receivables.overdueCount > 0
              ? `${formatCurrency(summary.receivables.overdue, { compact: true })} overdue · ${summary.receivables.overdueCount} invoice(s)`
              : 'Nothing overdue'
          }
          tone={summary.receivables.overdueCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <Tabs
        tabs={[
          { key: 'invoices', label: `Invoices (${invoices.length})` },
          { key: 'expenses', label: `Expenses (${expenses.length})` },
          ...(canManageVendors ? [{ key: 'vendors', label: `Vendors (${vendors.length})` }] : []),
          ...(can(PERMISSIONS.LEDGER_READ) ? [{ key: 'ledger', label: 'Daily ledger' }] : []),
        ]}
        active={tab}
        onChange={(key) => setTab(key as typeof tab)}
      />

      <div className="p-6">
        {tab === 'invoices' &&
          (invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No invoices yet"
              description="Create your first invoice to start billing clients."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                      <th className="px-4 py-2.5 font-semibold">Number</th>
                      <th className="px-4 py-2.5 font-semibold">Client</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Due</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-3">
                          <Link
                            href={`/finance/invoices/${invoice.id}`}
                            className="metric text-body-sm font-medium text-primary hover:text-brand-600"
                          >
                            {invoice.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-body-sm text-secondary">
                          {invoice.client?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={invoice.isOverdue ? 'danger' : INVOICE_TONE[invoice.status] ?? 'neutral'}>
                            {invoice.isOverdue ? 'Overdue' : titleCase(invoice.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-body-sm text-secondary">{formatDate(invoice.dueDate)}</td>
                        <td className="metric px-4 py-3 text-right text-body-sm font-medium text-primary">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="metric px-4 py-3 text-right text-body-sm text-secondary">
                          {invoice.balance > 0 ? formatCurrency(invoice.balance) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {invoice.status === 'DRAFT' && canManageInvoices && (
                            <Button variant="secondary" size="sm" onClick={() => void markSent(invoice.id)}>
                              Mark sent
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

        {tab === 'expenses' &&
          (expenses.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No expenses yet"
              description="Submitted expenses will show up here for approval."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                      <th className="px-4 py-2.5 font-semibold">Title</th>
                      <th className="px-4 py-2.5 font-semibold">Category</th>
                      <th className="px-4 py-2.5 font-semibold">Submitted by</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-3 text-body-sm font-medium text-primary">{expense.title}</td>
                        <td className="px-4 py-3 text-body-sm text-secondary">{expense.category}</td>
                        <td className="px-4 py-3 text-body-sm text-secondary">
                          {expense.submittedBy?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={EXPENSE_TONE[expense.status] ?? 'neutral'}>
                            {titleCase(expense.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-body-sm text-secondary">
                          {formatDate(expense.incurredAt)}
                        </td>
                        <td className="metric px-4 py-3 text-right text-body-sm font-medium text-primary">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {expense.status === 'SUBMITTED' && canApproveExpenses && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                title="Approve"
                                onClick={() => void approveExpense(expense.id, true)}
                                className="rounded-md p-1.5 text-success transition-colors hover:bg-success-bg"
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                onClick={() => void approveExpense(expense.id, false)}
                                className="rounded-md p-1.5 text-danger transition-colors hover:bg-danger-bg"
                              >
                                <XCircle className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

        {tab === 'vendors' &&
          (vendors.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No vendors yet"
              description="Add vendors to attribute expenses to them."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((vendor) => (
                <Card key={vendor.id}>
                  <CardHeader>
                    <CardTitle>{vendor.name}</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-1 text-body-sm text-secondary">
                    {vendor.category && <p>{titleCase(vendor.category)}</p>}
                    {vendor.email && <p>{vendor.email}</p>}
                    {vendor.phone && <p>{vendor.phone}</p>}
                  </CardBody>
                </Card>
              ))}
            </div>
          ))}

        {tab === 'ledger' && <LedgerTab />}
      </div>

      <NewInvoiceModal
        open={showNewInvoice}
        onClose={() => setShowNewInvoice(false)}
        clients={clients}
        onCreated={async () => {
          setShowNewInvoice(false);
          await load();
        }}
      />
      <NewExpenseModal
        open={showNewExpense}
        onClose={() => setShowNewExpense(false)}
        onCreated={async () => {
          setShowNewExpense(false);
          await load();
        }}
      />
      <NewVendorModal
        open={showNewVendor}
        onClose={() => setShowNewVendor(false)}
        onCreated={async () => {
          setShowNewVendor(false);
          await load();
        }}
      />
    </>
  );
}

function NewInvoiceModal({
  open,
  onClose,
  clients,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  onCreated: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('Monthly retainer');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClientId(clients[0]?.id ?? '');
      setDescription('Monthly retainer');
      setQuantity('1');
      setUnitPrice('');
      setDueDate('');
      setError(null);
    }
  }, [open, clients]);

  const submit = async () => {
    const price = Number(unitPrice);
    const qty = Number(quantity);
    if (!clientId || !description.trim() || !price || price <= 0 || !qty || qty <= 0) {
      setError('Client, description, quantity and a positive unit price are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/finance/invoices', {
        clientId,
        dueDate: dueDate || undefined,
        items: [{ description, quantity: qty, unitPrice: price, taxRate: 18 }],
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New invoice">
      <div className="space-y-4">
        <Field label="Client">
          <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Unit price (₹)">
            <Input
              type="number"
              min="0"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Due date (optional, defaults to 30 days)">
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create invoice
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NewExpenseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Operations');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setCategory('Operations');
      setAmount('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const value = Number(amount);
    if (!title.trim() || !category.trim() || !value || value <= 0) {
      setError('Title, category and a positive amount are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/finance/expenses', { title, category, amount: value });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New expense">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Software subscription" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            {['Payroll', 'Rent', 'Software', 'Contractors', 'Operations', 'Travel', 'Other'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Submit expense
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NewVendorModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setCategory('');
      setEmail('');
      setPhone('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/finance/vendors', {
        name,
        category: category || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the vendor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New vendor">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Category (optional)">
          <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Software" />
        </Field>
        <Field label="Email (optional)">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Phone (optional)">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Add vendor
          </Button>
        </div>
      </div>
    </Modal>
  );
}
