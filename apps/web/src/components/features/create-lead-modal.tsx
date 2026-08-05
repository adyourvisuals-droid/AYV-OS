'use client';

import { useEffect, useState } from 'react';

import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { titleCase } from '@/lib/utils';

const SOURCES = ['MANUAL', 'WEBSITE', 'META', 'GOOGLE', 'REFERRAL', 'WHATSAPP', 'LINKEDIN', 'WALK_IN', 'IMPORT'];

/** Shared between the leads list and the pipeline board — one form, one endpoint, two entry points. */
export function CreateLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('MANUAL');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setSource('MANUAL');
    setEstimatedValue('');
    setNotes('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      setError('A lead name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/crm/leads', {
        name,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        source,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        notes: notes || undefined,
      });
      onCreated(created.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New lead">
      <div className="space-y-4">
        <Field label="Lead / company name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bloom Education" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name">
            <Input value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={source} onChange={(event) => setSource(event.target.value)}>
              {SOURCES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>
        <Field label="Estimated value (₹)">
          <Input
            type="number"
            value={estimatedValue}
            onChange={(event) => setEstimatedValue(event.target.value)}
            placeholder="150000"
          />
        </Field>
        <Field label="Notes (optional)">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Create lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}
