'use client';

import { useEffect, useState } from 'react';

import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const SHOOT_TYPES = ['PHOTO', 'VIDEO', 'REEL', 'EVENT', 'OTHER'];
const STATUSES = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export interface ShootForEdit {
  id: string;
  title: string;
  client: { id: string; name: string } | null;
  type: string | null;
  scheduledAt: string;
  endAt: string | null;
  location: string | null;
  crewIds: string[];
  equipment: string | null;
  notes: string | null;
  status: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CrewOption {
  id: string;
  name: string;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function ShootModal({
  open,
  shoot,
  defaultDate,
  clients,
  crew,
  onClose,
  onSaved,
}: {
  open: boolean;
  shoot?: ShootForEdit | null;
  defaultDate?: string;
  clients: ClientOption[];
  crew: CrewOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [type, setType] = useState('PHOTO');
  const [scheduledAt, setScheduledAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [equipment, setEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('PLANNED');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (shoot) {
      setTitle(shoot.title);
      setClientId(shoot.client?.id ?? '');
      setType(shoot.type ?? 'PHOTO');
      setScheduledAt(toLocalInput(shoot.scheduledAt));
      setEndAt(shoot.endAt ? toLocalInput(shoot.endAt) : '');
      setLocation(shoot.location ?? '');
      setCrewIds(shoot.crewIds);
      setEquipment(shoot.equipment ?? '');
      setNotes(shoot.notes ?? '');
      setStatus(shoot.status);
    } else {
      setTitle('');
      setClientId('');
      setType('PHOTO');
      setScheduledAt(defaultDate ? `${defaultDate}T10:00` : '');
      setEndAt('');
      setLocation('');
      setCrewIds([]);
      setEquipment('');
      setNotes('');
      setStatus('PLANNED');
    }
    setError(null);
  }, [open, shoot, defaultDate]);

  const toggleCrew = (id: string) => {
    setCrewIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('A title is required');
      return;
    }
    if (!scheduledAt) {
      setError('A date and time is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title,
        clientId: clientId || undefined,
        type,
        scheduledAt,
        endAt: endAt || undefined,
        location: location || undefined,
        crewIds,
        equipment: equipment || undefined,
        notes: notes || undefined,
        status,
      };

      if (shoot) {
        await api.patch(`/creative/shoots/${shoot.id}`, payload);
      } else {
        await api.post('/creative/shoots', payload);
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the shoot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={shoot ? 'Edit shoot' : 'New shoot'} className="max-w-xl">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product photoshoot — Diwali collection" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Client (optional)">
            <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {SHOOT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0) + option.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
          </Field>
        </div>

        <Field label="Location">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Studio 2, Andheri" />
        </Field>

        <div>
          <span className="mb-1.5 block text-caption font-medium text-secondary">Crew</span>
          <div className="flex flex-wrap gap-1.5">
            {crew.length === 0 && <p className="text-body-sm text-tertiary">No team members found.</p>}
            {crew.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleCrew(member.id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-caption font-medium transition-colors',
                  crewIds.includes(member.id)
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-subtle text-secondary hover:text-primary',
                )}
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>

        <Field label="Equipment (optional)">
          <Input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="2x camera bodies, lighting kit, gimbal" />
        </Field>

        <Field label="Notes (optional)">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {shoot ? 'Save changes' : 'Create shoot'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
