'use client';

import { useEffect, useState } from 'react';
import { addDays, addWeeks, format } from 'date-fns';

import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, titleCase } from '@/lib/utils';

const LOGGABLE_TYPES = ['NOTE', 'CALL', 'MEETING', 'EMAIL', 'WHATSAPP'];

const FOLLOW_UP_PRESETS = [
  { label: 'Tomorrow', getDate: () => addDays(new Date(), 1) },
  { label: 'In 3 days', getDate: () => addDays(new Date(), 3) },
  { label: 'Next week', getDate: () => addWeeks(new Date(), 1) },
];

/**
 * Logs a touchpoint against a lead and, in the same action, reschedules the
 * next one. This is the core of the follow-up system: a rep finishing a
 * call sets "call back Thursday" without a second trip to an edit form —
 * used from the lead detail page and from the follow-ups worklist alike.
 */
export function LogActivityModal({
  open,
  leadId,
  leadName,
  onClose,
  onLogged,
}: {
  open: boolean;
  leadId: string;
  leadName?: string;
  onClose: () => void;
  onLogged: () => Promise<void>;
}) {
  const [type, setType] = useState('CALL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [outcome, setOutcome] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('CALL');
    setTitle('');
    setBody('');
    setOutcome('');
    setDurationMinutes('');
    setNextFollowUpAt('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/crm/leads/${leadId}/activities`, {
        type,
        title,
        body: body || undefined,
        outcome: outcome || undefined,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        nextFollowUpAt: nextFollowUpAt || undefined,
      });
      await onLogged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not log this activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={leadName ? `Log activity — ${leadName}` : 'Log activity'}>
      <div className="space-y-4">
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            {LOGGABLE_TYPES.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Discovery call with the founder"
          />
        </Field>
        <Field label="Details (optional)">
          <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Outcome (optional)">
            <Input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Interested" />
          </Field>
          <Field label="Duration, minutes (optional)">
            <Input
              type="number"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Next follow-up (optional)">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {FOLLOW_UP_PRESETS.map((preset) => {
                const value = format(preset.getDate(), 'yyyy-MM-dd');
                const active = nextFollowUpAt === value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setNextFollowUpAt(active ? '' : value)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-caption font-medium transition-colors',
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-600'
                        : 'border-subtle text-secondary hover:text-primary',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <Input
              type="date"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
            />
          </div>
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Log activity
          </Button>
        </div>
      </div>
    </Modal>
  );
}
