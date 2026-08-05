'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { addDays, addWeeks, format } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  StickyNote,
  Users as MeetingIcon,
} from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { LogActivityModal } from '@/components/features/log-activity-modal';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatDate, formatRelative, titleCase } from '@/lib/utils';

interface LeadDetail {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  source: string;
  status: string;
  temperature: string;
  industry: string | null;
  services: string[];
  estimatedValue: number;
  score: number;
  closeProbability: number | null;
  notes: string | null;
  lostReason: string | null;
  winReason: string | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  convertedClientId: string | null;
  daysInStage: number;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  counts: { activities: number; quotations: number };
}

interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  outcome: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const TEMPERATURE_TONE: Record<string, 'danger' | 'warning' | 'info'> = {
  HOT: 'danger',
  WARM: 'warning',
  COLD: 'info',
};

const ACTIVITY_ICON: Record<string, typeof Phone> = {
  CALL: Phone,
  MEETING: MeetingIcon,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  NOTE: StickyNote,
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const leadId = params.id;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [converting, setConverting] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [leadData, activityData] = await Promise.all([
        api.get<LeadDetail>(`/crm/leads/${leadId}`),
        api.get<Activity[]>(`/crm/leads/${leadId}/activities?limit=50`),
      ]);
      setLead(leadData);
      setActivities(activityData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the lead');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const convert = async () => {
    setConverting(true);
    try {
      const client = await api.post<{ id: string }>(`/crm/leads/${leadId}/convert`);
      router.push(`/clients/${client.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not convert this lead');
      setConverting(false);
    }
  };

  const setFollowUp = async (date: string | null) => {
    setSavingFollowUp(true);
    try {
      const updated = await api.patch<LeadDetail>(`/crm/leads/${leadId}`, { nextFollowUpAt: date });
      setLead((current) => (current ? { ...current, nextFollowUpAt: updated.nextFollowUpAt } : current));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the follow-up date');
    } finally {
      setSavingFollowUp(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error && !lead) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }
  if (!lead) return null;

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/crm/leads" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Leads
            </Link>
            {lead.company && <span>· {lead.company}</span>}
            <span>· {lead.daysInStage}d in stage</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge>{titleCase(lead.status)}</Badge>
            <Badge tone={TEMPERATURE_TONE[lead.temperature] ?? 'neutral'}>{titleCase(lead.temperature)}</Badge>
            {lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() && (
              <Badge tone="danger">Follow-up overdue</Badge>
            )}
            {lead.owner && <Avatar name={lead.owner.name} src={lead.owner.avatarUrl} />}
            {can(PERMISSIONS.LEAD_UPDATE) && (
              <Button size="sm" variant="secondary" onClick={() => setShowEdit(true)}>
                Edit
              </Button>
            )}
            {lead.status === 'WON' && !lead.convertedClientId && can(PERMISSIONS.LEAD_CONVERT) && (
              <Button size="sm" onClick={() => void convert()} loading={converting}>
                Convert to client
              </Button>
            )}
            {lead.convertedClientId && (
              <Link href={`/clients/${lead.convertedClientId}`}>
                <Button size="sm" variant="secondary">
                  View client
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Timeline</CardTitle>
            {can(PERMISSIONS.ACTIVITY_CREATE) && (
              <Button size="sm" variant="secondary" onClick={() => setShowLog(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Log activity
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {error && <p className="mb-3 text-body-sm text-danger">{error}</p>}
            {activities.length === 0 ? (
              <p className="py-8 text-center text-body-sm text-secondary">
                No activity logged yet. Calls, meetings, emails and WhatsApp threads show up here.
              </p>
            ) : (
              <ul className="space-y-4">
                {activities.map((activity) => {
                  const Icon = ACTIVITY_ICON[activity.type];
                  return (
                    <li key={activity.id} className="flex gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken text-tertiary">
                        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />}
                      </div>
                      <div className="min-w-0 flex-1 border-b border-subtle pb-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-body-sm font-medium text-primary">{activity.title}</p>
                          <span className="text-caption text-tertiary">{formatRelative(activity.occurredAt)}</span>
                        </div>
                        {activity.body && <p className="mt-1 text-body-sm text-secondary">{activity.body}</p>}
                        <div className="mt-1 flex items-center gap-2 text-caption text-tertiary">
                          {activity.actor && <span>{activity.actor.name}</span>}
                          {activity.durationMinutes !== null && <span>· {activity.durationMinutes}m</span>}
                          {activity.outcome && <span>· {activity.outcome}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          {can(PERMISSIONS.LEAD_UPDATE) && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Next follow-up</CardTitle>
                <CalendarClock className="h-4 w-4 text-tertiary" aria-hidden />
              </CardHeader>
              <CardBody className="space-y-3">
                {lead.nextFollowUpAt ? (
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-body-sm font-medium',
                        new Date(lead.nextFollowUpAt) < new Date() ? 'text-danger' : 'text-primary',
                      )}
                    >
                      {formatDate(lead.nextFollowUpAt, 'long')}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void setFollowUp(null)}
                      loading={savingFollowUp}
                    >
                      Mark done
                    </Button>
                  </div>
                ) : (
                  <p className="text-body-sm text-secondary">No follow-up scheduled.</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Tomorrow', getDate: () => addDays(new Date(), 1) },
                    { label: 'In 3 days', getDate: () => addDays(new Date(), 3) },
                    { label: 'Next week', getDate: () => addWeeks(new Date(), 1) },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      size="sm"
                      variant="secondary"
                      onClick={() => void setFollowUp(format(preset.getDate(), 'yyyy-MM-dd'))}
                      disabled={savingFollowUp}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Deal</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-secondary">Estimated value</span>
                <span className="metric text-body-sm font-medium text-primary">
                  {formatCurrency(lead.estimatedValue)}
                </span>
              </div>
              {lead.closeProbability !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-secondary">Close probability</span>
                  <span className="metric text-body-sm font-medium text-primary">
                    {Math.round(lead.closeProbability * 100)}%
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-secondary">AI score</span>
                <span className="metric text-body-sm font-medium text-primary">{lead.score}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-secondary">Source</span>
                <span className="text-body-sm text-primary">{titleCase(lead.source)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-secondary">Created</span>
                <span className="text-body-sm text-primary">{formatDate(lead.createdAt, 'long')}</span>
              </div>
              {lead.services.length > 0 && (
                <div className="border-t border-subtle pt-3">
                  <p className="mb-1.5 text-overline uppercase text-tertiary">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.services.map((service) => (
                      <Badge key={service} tone="brand">
                        {titleCase(service)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {lead.lostReason && (
                <div className="border-t border-subtle pt-3">
                  <p className="text-overline uppercase text-tertiary">Lost reason</p>
                  <p className="mt-1 text-body-sm text-secondary">{lead.lostReason}</p>
                </div>
              )}
              {lead.winReason && (
                <div className="border-t border-subtle pt-3">
                  <p className="text-overline uppercase text-tertiary">Win reason</p>
                  <p className="mt-1 text-body-sm text-secondary">{lead.winReason}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {lead.contactName && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={lead.contactName} size="sm" />
                  <span className="text-body-sm text-primary">{lead.contactName}</span>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2 text-body-sm text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-tertiary" aria-hidden />
                  {lead.company}
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-body-sm text-secondary">
                  <Mail className="h-3.5 w-3.5 text-tertiary" aria-hidden />
                  {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-body-sm text-secondary">
                  <Phone className="h-3.5 w-3.5 text-tertiary" aria-hidden />
                  {lead.phone}
                </div>
              )}
              {lead.notes && (
                <div className="border-t border-subtle pt-2.5">
                  <p className="mb-1 text-overline uppercase text-tertiary">Notes</p>
                  <p className="text-body-sm text-secondary">{lead.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <LogActivityModal
        open={showLog}
        onClose={() => setShowLog(false)}
        onLogged={async () => {
          setShowLog(false);
          await load();
        }}
        leadId={lead.id}
      />

      <EditLeadModal
        open={showEdit}
        lead={lead}
        onClose={() => setShowEdit(false)}
        onSaved={async () => {
          setShowEdit(false);
          await load();
        }}
      />
    </>
  );
}

function EditLeadModal({
  open,
  lead,
  onClose,
  onSaved,
}: {
  open: boolean;
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(lead.name);
    setContactName(lead.contactName ?? '');
    setEmail(lead.email ?? '');
    setPhone(lead.phone ?? '');
    setCompany(lead.company ?? '');
    setEstimatedValue(String(lead.estimatedValue));
    setNotes(lead.notes ?? '');
    setError(null);
  }, [open, lead]);

  const submit = async () => {
    if (!name.trim()) {
      setError('A lead name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/crm/leads/${lead.id}`, {
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : 0,
        notes: notes || null,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit lead">
      <div className="space-y-4">
        <Field label="Lead / company name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name">
            <Input value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(event) => setCompany(event.target.value)} />
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
          />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
