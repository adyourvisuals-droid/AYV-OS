'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, Plus } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import { SocialPostModal, type SocialPostForEdit } from '@/components/features/social-post-modal';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, titleCase } from '@/lib/utils';

interface SocialPost {
  id: string;
  client: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  platforms: string[];
  caption: string | null;
  hashtags: string[];
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'> = {
  IDEA: 'neutral',
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  SCHEDULED: 'brand',
  PUBLISHED: 'success',
  FAILED: 'danger',
};

export default function ContentCalendarPage() {
  const { can } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPostForEdit | null>(null);
  const [creatingForDate, setCreatingForDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canManage = can(PERMISSIONS.POST_MANAGE);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const load = useCallback(async () => {
    setError(null);
    try {
      const from = gridStart.toISOString();
      const to = gridEnd.toISOString();
      const [postData, clientData, campaignData] = await Promise.all([
        api.get<SocialPost[]>(`/social/posts?from=${from}&to=${to}&limit=300`),
        api.get<ClientOption[]>('/clients?limit=100'),
        api.get<CampaignOption[]>('/social/campaigns?limit=100').catch(() => []),
      ]);
      setPosts(postData);
      setClients(clientData);
      setCampaigns(campaignData);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the content calendar');
    } finally {
      setLoading(false);
    }
    // gridStart/gridEnd are derived from `month` — re-running on month change is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const unscheduled = useMemo(() => posts.filter((post) => !post.scheduledAt), [posts]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const key = format(new Date(post.scheduledAt), 'yyyy-MM-dd');
      const bucket = map.get(key) ?? [];
      bucket.push(post);
      map.set(key, bucket);
    }
    return map;
  }, [posts]);

  const openEdit = (post: SocialPost) => {
    setEditingPost({
      id: post.id,
      client: post.client,
      campaign: post.campaign,
      platforms: post.platforms,
      caption: post.caption,
      hashtags: post.hashtags,
      mediaUrls: post.mediaUrls,
      status: post.status,
      scheduledAt: post.scheduledAt,
    });
    setCreatingForDate(null);
    setShowModal(true);
  };

  const openCreate = (date?: string) => {
    setEditingPost(null);
    setCreatingForDate(date ?? null);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Content calendar"
        subtitle="Plan, schedule and track social posts across platforms."
        actions={
          canManage && (
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" aria-hidden />
              New post
            </Button>
          )
        }
      />

      <div className="space-y-4 p-6">
        {error && <p className="text-body-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <p className="w-40 text-center text-body-md font-medium text-primary">{format(month, 'MMMM yyyy')}</p>
            <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-subtle bg-sunken/40">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="px-2 py-2 text-center text-overline uppercase text-tertiary">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayPosts = postsByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[110px] border-b border-r border-subtle p-1.5 last:border-r-0',
                    !inMonth && 'bg-sunken/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-caption',
                        isToday(day) ? 'bg-brand-500 font-semibold text-white' : 'text-tertiary',
                        !inMonth && 'text-tertiary/50',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {canManage && inMonth && (
                      <button
                        type="button"
                        onClick={() => openCreate(key)}
                        className="text-tertiary opacity-0 transition-opacity hover:text-brand-600 group-hover:opacity-100"
                        aria-label={`New post on ${key}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => openEdit(post)}
                        className={cn(
                          'block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium',
                          STATUS_TONE[post.status] === 'success' && 'bg-success-bg text-success',
                          STATUS_TONE[post.status] === 'warning' && 'bg-warning-bg text-warning',
                          STATUS_TONE[post.status] === 'danger' && 'bg-danger-bg text-danger',
                          STATUS_TONE[post.status] === 'info' && 'bg-info-bg text-info',
                          STATUS_TONE[post.status] === 'brand' && 'bg-brand-50 text-brand-600',
                          STATUS_TONE[post.status] === 'neutral' && 'bg-sunken text-secondary',
                        )}
                        title={post.caption ?? undefined}
                      >
                        {post.platforms[0] ? titleCase(post.platforms[0]) : 'Post'}
                        {post.caption ? ` · ${post.caption}` : ''}
                      </button>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="px-1.5 text-[11px] text-tertiary">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-tertiary" aria-hidden />
            <p className="text-body-sm font-medium text-primary">Unscheduled ideas ({unscheduled.length})</p>
          </div>
          {unscheduled.length === 0 ? (
            <p className="text-body-sm text-tertiary">No unscheduled ideas — everything here has a date.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unscheduled.map((post) => (
                <Card key={post.id} interactive className="cursor-pointer p-3" onClick={() => openEdit(post)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium text-secondary">
                      {post.platforms.map((p) => titleCase(p)).join(', ')}
                    </span>
                    <Badge tone={STATUS_TONE[post.status] ?? 'neutral'}>{titleCase(post.status)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-body-sm text-primary">{post.caption || 'No caption yet'}</p>
                  {post.client && (
                    <Link
                      href={`/clients/${post.client.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 inline-block text-caption text-brand-600 hover:underline"
                    >
                      {post.client.name}
                    </Link>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <SocialPostModal
        open={showModal}
        post={editingPost}
        defaultDate={creatingForDate ?? undefined}
        clients={clients}
        campaigns={campaigns}
        onClose={() => setShowModal(false)}
        onSaved={async () => {
          setShowModal(false);
          await load();
        }}
      />
    </>
  );
}
