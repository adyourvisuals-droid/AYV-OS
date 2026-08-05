'use client';

import { useEffect, useState } from 'react';

import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

export interface ContractForEdit {
  id: string;
  title: string;
  value: number;
  startDate: string | null;
  endDate: string | null;
  noticePeriodDays: number | null;
}

/** Creates a contract, or edits one still in DRAFT — prefillValue seeds the deal amount from a won quotation. */
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
  const [terms, setTerms] = useState('');
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
    } else {
      setTitle('');
      setValue(prefillValue ? String(prefillValue) : '');
      setStartDate('');
      setEndDate('');
      setNoticePeriodDays('30');
      setTerms('');
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
      const payload = {
        title,
        value: value ? Number(value) : 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
        ...(contract ? {} : { terms: terms ? { notes: terms } : undefined, clientId, leadId }),
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
    <Modal open={open} onClose={onClose} title={contract ? 'Edit contract' : 'New contract'}>
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
        {!contract && (
          <Field label="Terms (optional)">
            <Textarea rows={3} value={terms} onChange={(event) => setTerms(event.target.value)} />
          </Field>
        )}

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
