'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

export interface TermsClause {
  title: string;
  body: string;
}

export interface ContractForEdit {
  id: string;
  title: string;
  value: number;
  startDate: string | null;
  endDate: string | null;
  noticePeriodDays: number | null;
  terms: unknown;
}

const DEFAULT_CLAUSES: TermsClause[] = [
  { title: 'Scope of work', body: '' },
  { title: 'Payment terms', body: '' },
  { title: 'Termination', body: '' },
];

/**
 * Reads whatever shape `Contract.terms` happens to hold — structured
 * clauses, or the legacy single-note blob — returning `[]` when there's
 * nothing there. Read-only views (the document page) should show nothing
 * rather than an empty template; only the edit form seeds a starting
 * template via `parseTermsForEditing` below.
 */
export function parseTerms(raw: unknown): TermsClause[] {
  if (raw && typeof raw === 'object' && Array.isArray((raw as { clauses?: unknown }).clauses)) {
    const clauses = (raw as { clauses: unknown[] }).clauses;
    return clauses
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry) => ({
        title: typeof entry.title === 'string' ? entry.title : '',
        body: typeof entry.body === 'string' ? entry.body : '',
      }))
      .filter((clause) => clause.title.trim() || clause.body.trim());
  }
  if (raw && typeof raw === 'object' && typeof (raw as { notes?: unknown }).notes === 'string') {
    const notes = (raw as { notes: string }).notes;
    return notes.trim() ? [{ title: 'Terms', body: notes }] : [];
  }
  return [];
}

/** Same parse, but falls back to a starting template of blank clauses — used to seed the edit form. */
export function parseTermsForEditing(raw: unknown): TermsClause[] {
  const parsed = parseTerms(raw);
  return parsed.length > 0 ? parsed : DEFAULT_CLAUSES;
}

/** Creates a contract, or edits one still in DRAFT — terms are a dynamic list of clauses, editable either way. */
export function ContractModal({
  open,
  clientId,
  leadId,
  prefillValue,
  contract,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId?: string;
  leadId?: string;
  prefillValue?: number;
  contract?: ContractForEdit | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [clauses, setClauses] = useState<TermsClause[]>(DEFAULT_CLAUSES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setTitle(contract.title);
      setValue(String(contract.value));
      setStartDate(contract.startDate ? contract.startDate.slice(0, 10) : '');
      setEndDate(contract.endDate ? contract.endDate.slice(0, 10) : '');
      setNoticePeriodDays(contract.noticePeriodDays !== null ? String(contract.noticePeriodDays) : '30');
      setClauses(parseTermsForEditing(contract.terms));
    } else {
      setTitle('');
      setValue(prefillValue ? String(prefillValue) : '');
      setStartDate('');
      setEndDate('');
      setNoticePeriodDays('30');
      setClauses(DEFAULT_CLAUSES);
    }
    setError(null);
  }, [open, contract, prefillValue]);

  const submit = async () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const cleanedClauses = clauses.filter((clause) => clause.title.trim() || clause.body.trim());

      const payload = {
        title,
        value: value ? Number(value) : 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
        terms: cleanedClauses.length > 0 ? { clauses: cleanedClauses } : undefined,
        ...(contract ? {} : { clientId, leadId }),
      };

      if (contract) {
        await api.patch(`/crm/contracts/${contract.id}`, payload);
      } else {
        await api.post('/crm/contracts', payload);
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the contract');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={contract ? 'Edit contract' : 'New contract'} className="max-w-xl">
      <div className="space-y-4">
        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Annual retainer — social + performance"
          />
        </Field>
        <Field label="Contract value (₹)">
          <Input type="number" value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Notice period (days)">
          <Input
            type="number"
            value={noticePeriodDays}
            onChange={(event) => setNoticePeriodDays(event.target.value)}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption font-medium text-secondary">Terms &amp; conditions</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setClauses((prev) => [...prev, { title: '', body: '' }])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add clause
            </Button>
          </div>
          <div className="space-y-2">
            {clauses.map((clause, index) => (
              <div key={index} className="space-y-1.5 rounded-md border border-subtle p-2.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={clause.title}
                    onChange={(event) =>
                      setClauses((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)),
                      )
                    }
                    placeholder="Clause title (e.g. Payment terms)"
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setClauses((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={clause.body}
                  onChange={(event) =>
                    setClauses((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, body: event.target.value } : row)),
                    )
                  }
                  placeholder="Clause text…"
                />
              </div>
            ))}
            {clauses.length === 0 && (
              <p className="text-body-sm text-tertiary">No clauses yet — add one above.</p>
            )}
          </div>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {contract ? 'Save changes' : 'Create contract'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
