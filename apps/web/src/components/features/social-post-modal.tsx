'use client';

import { useEffect, useState } from 'react';

import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn, titleCase } from '@/lib/utils';

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'X', 'GOOGLE_BUSINESS'];
const CREATE_STATUSES = ['IDEA', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'];

export interface SocialPostForEdit {
  id: string;
  client: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  platforms: string[];
  caption: string | null;
  hashtags: string[];
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

/** Local datetime string for a <input type="datetime-local"> from an ISO timestamp. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SocialPostModal({
  open,
  post,
  defaultDate,
  clients,
  campaigns,
  onClose,
  onSaved,
}: {
  open: boolean;
  post?: SocialPostForEdit | null;
  defaultDate?: string;
  clients: ClientOption[];
  campaigns: CampaignOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mediaUrls, setMediaUrls] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState('IDEA');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = post?.status === 'PUBLISHED';

  useEffect(() => {
    if (!open) return;
    if (post) {
      setClientId(post.client?.id ?? '');
      setCampaignId(post.campaign?.id ?? '');
      setPlatforms(post.platforms);
      setCaption(post.caption ?? '');
      setHashtags(post.hashtags.join(' '));
      setMediaUrls(post.mediaUrls.join('\n'));
      setScheduledAt(toLocalInput(post.scheduledAt));
      setStatus(post.status);
    } else {
      setClientId('');
      setCampaignId('');
      setPlatforms([]);
      setCaption('');
      setHashtags('');
      setMediaUrls('');
      setScheduledAt(defaultDate ? `${defaultDate}T10:00` : '');
      setStatus('IDEA');
    }
    setError(null);
  }, [open, post, defaultDate]);

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const submit = async () => {
    if (platforms.length === 0) {
      setError('Select at least one platform');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        clientId: clientId || undefined,
        campaignId: campaignId || undefined,
        platforms,
        caption: caption || undefined,
        hashtags: hashtags.trim() ? hashtags.trim().split(/\s+/) : [],
        mediaUrls: mediaUrls.trim() ? mediaUrls.split('\n').map((u) => u.trim()).filter(Boolean) : [],
        scheduledAt: scheduledAt || undefined,
      };

      if (post) {
        await api.patch(`/social/posts/${post.id}`, payload);
      } else {
        await api.post('/social/posts', { ...payload, status });
      }
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={post ? 'Edit post' : 'New post'} className="max-w-xl">
      <div className="space-y-4">
        {isPublished && (
          <p className="rounded-md bg-warning-bg px-3 py-2 text-body-sm text-warning">
            This post has already been published and can no longer be edited.
          </p>
        )}

        <div>
          <span className="mb-1.5 block text-caption font-medium text-secondary">Platforms</span>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                disabled={isPublished}
                onClick={() => togglePlatform(platform)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-caption font-medium transition-colors',
                  platforms.includes(platform)
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-subtle text-secondary hover:text-primary',
                )}
              >
                {titleCase(platform)}
              </button>
            ))}
          </div>
        </div>

        <Field label="Caption">
          <Textarea
            rows={4}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            disabled={isPublished}
            placeholder="What's the post about…"
          />
        </Field>

        <Field label="Hashtags (space-separated)">
          <Input value={hashtags} onChange={(event) => setHashtags(event.target.value)} disabled={isPublished} placeholder="#ayv #brand" />
        </Field>

        <Field label="Media URLs (one per line)">
          <Textarea rows={2} value={mediaUrls} onChange={(event) => setMediaUrls(event.target.value)} disabled={isPublished} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Client (optional)">
            <Select value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={isPublished}>
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign (optional)">
            <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={isPublished}>
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Scheduled for">
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={isPublished} />
          </Field>
          {!post && (
            <Field label="Starting status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                {CREATE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {!isPublished && (
            <Button onClick={() => void submit()} loading={submitting}>
              {post ? 'Save changes' : 'Create post'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
