'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Trash2, X } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
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
import { formatCurrency, titleCase } from '@/lib/utils';

const CATEGORIES = [
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
const CYCLES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];

const CYCLE_LABEL: Record<string, string> = {
  ONE_TIME: 'one-time',
  MONTHLY: '/mo',
  QUARTERLY: '/qtr',
  ANNUAL: '/yr',
};

interface Deliverable {
  label: string;
  quantity: number;
}

interface ServicePackage {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: string;
  deliverables: Deliverable[];
  isActive: boolean;
}

export function ServiceCatalogTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.PACKAGE_MANAGE);

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServicePackage | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPackages(await api.get<ServicePackage[]>('/agency/packages'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the service catalogue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    try {
      await api.delete(`/agency/packages/${id}`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove the package');
    }
  };

  const toggleActive = async (pkg: ServicePackage) => {
    try {
      await api.patch(`/agency/packages/${pkg.id}`, { isActive: !pkg.isActive });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the package');
    }
  };

  if (loading) return <Skeleton className="h-96" />;
  if (error && packages.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-secondary">
          Standardised offerings that quotations and retainers are built from.
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New package
          </Button>
        )}
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      {packages.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" aria-hidden />}
          title="No service packages yet"
          description={canManage ? 'Create your first package to standardise how you quote and deliver.' : 'Nothing has been set up yet.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={pkg.isActive ? '' : 'opacity-60'}>
              <CardBody className="space-y-3 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-medium text-primary">{pkg.name}</p>
                    {pkg.category && <p className="text-caption text-tertiary">{titleCase(pkg.category)}</p>}
                  </div>
                  {!pkg.isActive && <Badge tone="neutral">Inactive</Badge>}
                </div>

                <p className="flex items-baseline gap-1">
                  <span className="metric text-heading-md text-primary">{formatCurrency(pkg.price)}</span>
                  <span className="text-caption text-tertiary">{CYCLE_LABEL[pkg.billingCycle] ?? ''}</span>
                </p>

                {pkg.description && <p className="text-body-sm text-secondary">{pkg.description}</p>}

                {pkg.deliverables.length > 0 && (
                  <ul className="space-y-1 border-t border-subtle pt-2.5">
                    {pkg.deliverables.map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-caption text-secondary">
                        <span>{d.label}</span>
                        <span className="metric font-medium text-primary">×{d.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {canManage && (
                  <div className="flex items-center gap-2 border-t border-subtle pt-2.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(pkg)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(pkg)}>
                      {pkg.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void remove(pkg.id)}
                      className="ml-auto rounded p-1 text-tertiary transition-colors hover:bg-danger-bg hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <PackageModal
        open={creating || Boolean(editing)}
        pkg={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={async () => {
          setCreating(false);
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function PackageModal({
  open,
  pkg,
  onClose,
  onSaved,
}: {
  open: boolean;
  pkg: ServicePackage | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('SOCIAL_MEDIA');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [deliverables, setDeliverables] = useState<Deliverable[]>([{ label: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (pkg) {
      setName(pkg.name);
      setCategory(pkg.category ?? 'SOCIAL_MEDIA');
      setDescription(pkg.description ?? '');
      setPrice(String(pkg.price));
      setBillingCycle(pkg.billingCycle);
      setDeliverables(pkg.deliverables.length > 0 ? pkg.deliverables : [{ label: '', quantity: 1 }]);
    } else {
      setName('');
      setCategory('SOCIAL_MEDIA');
      setDescription('');
      setPrice('0');
      setBillingCycle('MONTHLY');
      setDeliverables([{ label: '', quantity: 1 }]);
    }
    setError(null);
  }, [open, pkg]);

  const submit = async () => {
    if (!name.trim()) {
      setError('A name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        category,
        description: description || undefined,
        price: Number(price) || 0,
        billingCycle,
        deliverables: deliverables.filter((d) => d.label.trim()),
      };
      if (pkg) {
        await api.patch(`/agency/packages/${pkg.id}`, payload);
      } else {
        await api.post('/agency/packages', payload);
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the package');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={pkg ? 'Edit package' : 'New package'} className="max-w-xl">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Social Media — Growth" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing cycle">
            <Select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Price (₹)">
          <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-caption font-medium text-secondary">Included deliverables (per cycle)</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeliverables((prev) => [...prev, { label: '', quantity: 1 }])}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {deliverables.map((d, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <Input
                  value={d.label}
                  onChange={(e) =>
                    setDeliverables((prev) => prev.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)))
                  }
                  placeholder="Instagram reels"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="1"
                  value={d.quantity}
                  onChange={(e) =>
                    setDeliverables((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, quantity: Number(e.target.value) } : row)),
                    )
                  }
                  className="w-20"
                />
                <Button size="icon" variant="ghost" onClick={() => setDeliverables((prev) => prev.filter((_, i) => i !== index))}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            {pkg ? 'Save package' : 'Create package'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
