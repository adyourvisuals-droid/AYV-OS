'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { DocumentLetterhead, DocumentPage, PrintButton } from '@/components/features/document-view';
import { ErrorState, Select, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

interface DeliverableItem {
  id: string;
  label: string;
  committed: number;
  delivered: number;
}

interface RetainerBlock {
  id: string;
  title: string;
  monthlyValue: number;
  currency: string;
  status: string;
  generated: boolean;
  committedTotal: number;
  deliveredTotal: number;
  items: DeliverableItem[];
}

interface PostBlock {
  id: string;
  caption: string | null;
  platforms: string[];
  publishedAt: string | null;
  reach: number | null;
  engagement: number | null;
}

interface InvoiceBlock {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
}

interface ClientReport {
  client: {
    id: string;
    name: string;
    legalName: string | null;
    industry: string | null;
    status: string;
    healthScore: number;
    currency: string;
    accountManager: { id: string; name: string } | null;
  };
  period: { month: number; year: number; label: string };
  retainers: RetainerBlock[];
  content: {
    publishedCount: number;
    reachTotal: number;
    engagementTotal: number;
    posts: PostBlock[];
  };
  finance: {
    invoices: InvoiceBlock[];
    billedTotal: number;
    collectedTotal: number;
    outstandingTotal: number;
  };
  summary: {
    committedTotal: number;
    deliveredTotal: number;
    completionRate: number | null;
    postsPublished: number;
    billedTotal: number;
    collectedTotal: number;
    outstandingTotal: number;
  };
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2000, i, 1), 'MMMM') }));

/** A compact figure on the report's summary strip. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-subtle bg-sunken px-3 py-2.5 print:bg-transparent">
      <p className="text-overline uppercase text-tertiary">{label}</p>
      <p className="metric mt-0.5 text-heading-sm font-semibold text-primary">{value}</p>
    </div>
  );
}

export default function ClientReportPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [report, setReport] = useState<ClientReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await api.get<ClientReport>(`/clients/${clientId}/report?month=${month}&year=${year}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the report');
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !report) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !report) {
    return <ErrorState message={error ?? 'Report not found'} onRetry={() => void load()} />;
  }

  const { client, period, retainers, content, finance, summary } = report;

  return (
    <>
      <PageHeader
        title="Monthly report"
        subtitle={
          <span className="flex flex-wrap items-center gap-2 print-hidden">
            <Link
              href={`/clients/${clientId}`}
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              {client.name}
            </Link>
            <span>· {period.label}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2 print-hidden">
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
            <PrintButton />
          </div>
        }
      />

      <div className="p-6">
        <DocumentPage>
          <DocumentLetterhead />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-overline uppercase text-tertiary">Monthly performance report</p>
              <p className="text-heading-md font-semibold text-primary">{client.legalName || client.name}</p>
              {client.industry && <p className="text-body-sm text-secondary">{titleCase(client.industry)}</p>}
            </div>
            <div className="text-right text-body-sm text-secondary">
              <p className="text-heading-sm font-semibold text-primary">{period.label}</p>
              {client.accountManager && <p>Account manager: {client.accountManager.name}</p>}
              <p>Health score: {client.healthScore}/100</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Deliverables"
              value={summary.completionRate === null ? '—' : `${summary.completionRate}%`}
            />
            <Stat label="Content published" value={String(summary.postsPublished)} />
            <Stat label="Billed" value={formatCurrency(summary.billedTotal, { compact: true })} />
            <Stat label="Collected" value={formatCurrency(summary.collectedTotal, { compact: true })} />
          </div>

          {/* ── Deliverables ─────────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="text-overline uppercase text-tertiary">Deliverables</h2>
            {retainers.length === 0 ? (
              <p className="mt-2 text-body-sm text-secondary">No retainers are attached to this client.</p>
            ) : (
              retainers.map((retainer) => (
                <div key={retainer.id} className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-body-md font-medium text-primary">{retainer.title}</p>
                    <p className="metric text-body-sm text-secondary">
                      {retainer.deliveredTotal} / {retainer.committedTotal} delivered
                    </p>
                  </div>
                  {retainer.generated ? (
                    <table className="mt-2 w-full text-left">
                      <thead>
                        <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                          <th className="py-1.5 pr-2 font-semibold">Deliverable</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Committed</th>
                          <th className="py-1.5 pr-2 text-right font-semibold">Delivered</th>
                          <th className="py-1.5 text-right font-semibold">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {retainer.items.map((item) => {
                          const pct =
                            item.committed > 0 ? Math.round((item.delivered / item.committed) * 100) : 0;
                          return (
                            <tr key={item.id}>
                              <td className="py-2 pr-2 text-body-sm text-primary">{item.label}</td>
                              <td className="metric py-2 pr-2 text-right text-body-sm text-secondary">
                                {item.committed}
                              </td>
                              <td className="metric py-2 pr-2 text-right text-body-sm text-secondary">
                                {item.delivered}
                              </td>
                              <td className="metric py-2 text-right text-body-sm font-medium text-primary">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mt-1 text-body-sm text-tertiary">This month was not started for this retainer.</p>
                  )}
                </div>
              ))
            )}
          </section>

          {/* ── Content shipped ──────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="text-overline uppercase text-tertiary">Content published</h2>
            {content.posts.length === 0 ? (
              <p className="mt-2 text-body-sm text-secondary">No posts were published this month.</p>
            ) : (
              <>
                <p className="mt-1 text-body-sm text-secondary">
                  {content.publishedCount} posts
                  {content.reachTotal > 0 && ` · ${content.reachTotal.toLocaleString('en-IN')} reach`}
                  {content.engagementTotal > 0 &&
                    ` · ${content.engagementTotal.toLocaleString('en-IN')} engagement`}
                </p>
                <ul className="mt-2 divide-y divide-subtle">
                  {content.posts.map((post) => (
                    <li key={post.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-body-sm text-primary">
                          {post.caption?.trim() || 'Untitled post'}
                        </p>
                        <p className="text-caption text-tertiary">
                          {post.platforms.map((p) => titleCase(p)).join(', ')}
                        </p>
                      </div>
                      <p className="shrink-0 text-caption text-tertiary">
                        {post.publishedAt ? formatDate(post.publishedAt) : '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ── Financials ───────────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="text-overline uppercase text-tertiary">Financials</h2>
            {finance.invoices.length === 0 ? (
              <p className="mt-2 text-body-sm text-secondary">No invoices were issued this month.</p>
            ) : (
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr className="border-b border-subtle text-overline uppercase text-tertiary">
                    <th className="py-1.5 pr-2 font-semibold">Invoice</th>
                    <th className="py-1.5 pr-2 font-semibold">Status</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">Total</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">Paid</th>
                    <th className="py-1.5 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {finance.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-2 pr-2 text-body-sm text-primary">{invoice.number}</td>
                      <td className="py-2 pr-2 text-body-sm text-secondary">{titleCase(invoice.status)}</td>
                      <td className="metric py-2 pr-2 text-right text-body-sm text-secondary">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="metric py-2 pr-2 text-right text-body-sm text-success">
                        {formatCurrency(invoice.amountPaid)}
                      </td>
                      <td className="metric py-2 text-right text-body-sm font-medium text-primary">
                        {formatCurrency(invoice.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="ml-auto mt-4 max-w-xs space-y-1.5">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-secondary">Billed this month</span>
                <span className="metric text-primary">{formatCurrency(finance.billedTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-secondary">Collected this month</span>
                <span className="metric text-success">{formatCurrency(finance.collectedTotal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-subtle pt-1.5 text-body-md font-semibold">
                <span className="text-primary">Outstanding</span>
                <span className="metric text-primary">{formatCurrency(finance.outstandingTotal)}</span>
              </div>
            </div>
          </section>

          <p className="mt-8 border-t border-subtle pt-4 text-caption text-tertiary">
            Generated {formatDate(new Date(), 'long')} · {client.name} · {period.label}
          </p>
        </DocumentPage>
      </div>
    </>
  );
}
