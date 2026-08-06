'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorState, Field, Input, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface OrganizationProfile {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  postalCode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankUpiId: string | null;
}

type FormState = Record<keyof Omit<OrganizationProfile, 'id' | 'slug' | 'name'>, string>;

function toForm(org: OrganizationProfile): FormState {
  return {
    legalName: org.legalName ?? '',
    logoUrl: org.logoUrl ?? '',
    website: org.website ?? '',
    email: org.email ?? '',
    phone: org.phone ?? '',
    addressLine1: org.addressLine1 ?? '',
    addressLine2: org.addressLine2 ?? '',
    city: org.city ?? '',
    state: org.state ?? '',
    stateCode: org.stateCode ?? '',
    country: org.country ?? '',
    postalCode: org.postalCode ?? '',
    gstNumber: org.gstNumber ?? '',
    panNumber: org.panNumber ?? '',
    bankName: org.bankName ?? '',
    bankAccountName: org.bankAccountName ?? '',
    bankAccountNumber: org.bankAccountNumber ?? '',
    bankIfscCode: org.bankIfscCode ?? '',
    bankUpiId: org.bankUpiId ?? '',
  };
}

export function OrganizationTab() {
  const { canAny } = useAuth();
  const canUpdate = canAny(PERMISSIONS.ORG_UPDATE);

  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<OrganizationProfile>('/settings/organization');
      setOrg(data);
      setForm(toForm(data));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the organisation profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => (current ? { ...current, [key]: event.target.value } : current));
    setSaved(false);
  };

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<OrganizationProfile>('/settings/organization', form);
      setOrg(data);
      setForm(toForm(data));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the organisation profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (error && !org) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!org || !form) return null;

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden />
            Organisation profile
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-body-sm text-secondary">
            This information appears on the letterhead of every printed invoice, quotation and contract.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Legal name">
              <Input value={form.legalName} onChange={set('legalName')} disabled={!canUpdate} placeholder={org.name} />
            </Field>
            <Field label="Logo URL">
              <Input value={form.logoUrl} onChange={set('logoUrl')} disabled={!canUpdate} placeholder="https://…" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set('email')} disabled={!canUpdate} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} disabled={!canUpdate} />
            </Field>
          </div>
          <Field label="Website">
            <Input value={form.website} onChange={set('website')} disabled={!canUpdate} placeholder="https://…" />
          </Field>

          <div className="border-t border-subtle pt-4">
            <p className="mb-3 text-overline uppercase text-tertiary">Address</p>
            <div className="space-y-3">
              <Field label="Address line 1">
                <Input value={form.addressLine1} onChange={set('addressLine1')} disabled={!canUpdate} />
              </Field>
              <Field label="Address line 2">
                <Input value={form.addressLine2} onChange={set('addressLine2')} disabled={!canUpdate} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <Input value={form.city} onChange={set('city')} disabled={!canUpdate} />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={set('state')} disabled={!canUpdate} placeholder="Maharashtra" />
                </Field>
                <Field label="State code">
                  <Input value={form.stateCode} onChange={set('stateCode')} disabled={!canUpdate} placeholder="27" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Postal code">
                  <Input value={form.postalCode} onChange={set('postalCode')} disabled={!canUpdate} />
                </Field>
                <Field label="Country">
                  <Input value={form.country} onChange={set('country')} disabled={!canUpdate} />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-subtle pt-4">
            <p className="mb-3 text-overline uppercase text-tertiary">Commercial</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GSTIN">
                <Input value={form.gstNumber} onChange={set('gstNumber')} disabled={!canUpdate} />
              </Field>
              <Field label="PAN">
                <Input value={form.panNumber} onChange={set('panNumber')} disabled={!canUpdate} />
              </Field>
            </div>
          </div>

          <div className="border-t border-subtle pt-4">
            <p className="mb-3 text-overline uppercase text-tertiary">Bank details (for payment instructions)</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank name">
                  <Input value={form.bankName} onChange={set('bankName')} disabled={!canUpdate} />
                </Field>
                <Field label="Account holder name">
                  <Input value={form.bankAccountName} onChange={set('bankAccountName')} disabled={!canUpdate} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account number">
                  <Input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} disabled={!canUpdate} />
                </Field>
                <Field label="IFSC code">
                  <Input value={form.bankIfscCode} onChange={set('bankIfscCode')} disabled={!canUpdate} />
                </Field>
              </div>
              <Field label="UPI ID">
                <Input value={form.bankUpiId} onChange={set('bankUpiId')} disabled={!canUpdate} placeholder="name@bank" />
              </Field>
            </div>
          </div>

          {error && <p className="text-body-sm text-danger">{error}</p>}
          {saved && <p className="text-body-sm text-success">Saved.</p>}

          {canUpdate && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => void submit()} loading={saving}>
                Save changes
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
