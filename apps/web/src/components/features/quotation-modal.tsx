'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { titleCase } from '@/lib/utils';

const SERVICES = [
  'BRANDING',
  'SOCIAL_MEDIA',
  'PERFORMANCE_MARKETING',
  'META_ADS',
  'GOOGLE_ADS',
  'WEBSITE',
  'VIDEO_EDITING',
  'GRAPHIC_DESIGN',
  'AI_CONTENT',
  'AI_VIDEO',
  'AUTOMATION',
  'CONSULTING',
];

interface QuotationItem {
  service: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuotationForEdit {
  id: string;
  discount: number;
  taxRate: number;
  validUntil: string | null;
  terms: string | null;
  notes: string | null;
  items: { service: string | null; description: string; quantity: number; unitPrice: number }[];
}

function emptyItem(): QuotationItem {
  return { service: null, description: '', quantity: 1, unitPrice: 0 };
}

/**
 * Creates a quotation, or edits one still in DRAFT — same form either way,
 * since the fields are identical and the API enforces the DRAFT-only rule
 * for edits itself.
 */
export function QuotationModal({
  open,
  leadId,
  clientId,
  quotation,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId?: string;
  clientId?: string;
  quotation?: QuotationForEdit | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [items, setItems] = useState<QuotationItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('18');
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (quotation) {
      setItems(quotation.items.length > 0 ? quotation.items : [emptyItem()]);
      setDiscount(String(quotation.discount));
      setTaxRate(String(quotation.taxRate));
      setValidUntil(quotation.validUntil ? quotation.validUntil.slice(0, 10) : '');
      setTerms(quotation.terms ?? '');
      setNotes(quotation.notes ?? '');
    } else {
      setItems([emptyItem()]);
      setDiscount('0');
      setTaxRate('18');
      setValidUntil('');
      setTerms('');
      setNotes('');
    }
    setError(null);
  }, [open, quotation]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const total = taxable + taxable * ((Number(taxRate) || 0) / 100);

  const submit = async () => {
    const cleanedItems = items
      .filter((item) => item.description.trim() && item.quantity > 0 && item.unitPrice >= 0)
      .map((item) => ({ ...item, service: item.service || undefined }));

    if (cleanedItems.length === 0) {
      setError('At least one line item with a description, quantity and price is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        items: cleanedItems,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
        validUntil: validUntil || undefined,
        terms: terms || undefined,
        notes: notes || undefined,
      };

      if (quotation) {
        await api.patch(`/crm/quotations/${quotation.id}`, payload);
      } else {
        await api.post('/crm/quotations', { ...payload, leadId, clientId });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the quotation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={quotation ? 'Edit quotation' : 'New quotation'} className="max-w-xl">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption font-medium text-secondary">Line items</span>
            <Button size="sm" variant="ghost" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="space-y-1.5 rounded-md border border-subtle p-2.5">
                <div className="flex items-center gap-1.5">
                  <Select
                    value={item.service ?? ''}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, service: event.target.value || null } : row)),
                      )
                    }
                    className="w-40 shrink-0"
                  >
                    <option value="">No service</option>
                    {SERVICES.map((service) => (
                      <option key={service} value={service}>
                        {titleCase(service)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={item.description}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, description: event.target.value } : row)),
                      )
                    }
                    placeholder="Description"
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, quantity: Number(event.target.value) } : row)),
                      )
                    }
                    placeholder="Qty"
                    className="w-20"
                  />
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, unitPrice: Number(event.target.value) } : row,
                        ),
                      )
                    }
                    placeholder="Unit price (₹)"
                    className="flex-1"
                  />
                  <span className="metric w-24 shrink-0 text-right text-body-sm text-secondary">
                    ₹{Math.round(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Discount (₹)">
            <Input type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </Field>
          <Field label="Tax rate (%)">
            <Input type="number" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
          </Field>
          <Field label="Valid until">
            <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
          </Field>
        </div>

        <Field label="Terms (optional)">
          <Textarea rows={2} value={terms} onChange={(event) => setTerms(event.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="flex items-center justify-between rounded-md bg-sunken px-3 py-2">
          <span className="text-body-sm text-secondary">Total</span>
          <span className="metric text-heading-sm text-primary">
            ₹{Math.round(total).toLocaleString('en-IN')}
          </span>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {quotation ? 'Save changes' : 'Create quotation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
