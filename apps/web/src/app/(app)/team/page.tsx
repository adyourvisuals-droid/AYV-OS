'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Hash, Megaphone, MessageSquare, Pin, Plus, Send, Trash2, Users } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { PageHeader } from '@/components/layout/app-shell';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn, titleCase } from '@/lib/utils';

interface ChannelRow {
  id: string;
  name: string | null;
  description: string | null;
  lastMessageAt: string | null;
  unread: number;
}
interface DmPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
}
interface DmRow {
  id: string;
  user: DmPerson | null;
  lastMessageAt: string | null;
  unread: number;
}
interface Overview {
  channels: ChannelRow[];
  dms: DmRow[];
  unreadTotal: number;
}
interface Message {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}
interface Thread {
  conversation: { id: string; type: 'CHANNEL' | 'DIRECT'; name: string | null; description: string | null; user: DmPerson | null };
  messages: Message[];
}
interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  department: string | null;
}
interface Announcement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  commentCount: number;
}

function timeLabel(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return format(d, 'h:mm a');
  return format(d, 'd MMM');
}

export default function TeamPage() {
  const { user, can } = useAuth();
  const canManageAnnouncements = can(PERMISSIONS.ANNOUNCEMENT_MANAGE);

  const [tab, setTab] = useState<'messages' | 'announcements'>('messages');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    setOverview(await api.get<Overview>('/comms/overview').catch(() => null));
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const data = await api.get<Thread>(`/comms/conversations/${id}`).catch(() => null);
    setThread(data);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadOverview();
      setLoading(false);
    })();
  }, [loadOverview]);

  // Auto-select the first channel on first load.
  useEffect(() => {
    if (!activeId && overview && overview.channels.length > 0) {
      setActiveId(overview.channels[0].id);
    }
  }, [overview, activeId]);

  useEffect(() => {
    if (activeId) void loadThread(activeId);
  }, [activeId, loadThread]);

  // Light polling keeps the open thread and unread badges reasonably live
  // without a websocket layer.
  useEffect(() => {
    const timer = setInterval(() => {
      void loadOverview();
      if (activeId && tab === 'messages') void loadThread(activeId);
    }, 6000);
    return () => clearInterval(timer);
  }, [activeId, tab, loadOverview, loadThread]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages.length, activeId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    setSending(true);
    setDraft('');
    try {
      await api.post(`/comms/conversations/${activeId}/messages`, { body: text });
      await Promise.all([loadThread(activeId), loadOverview()]);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const openDm = async (userId: string) => {
    const res = await api.post<{ id: string }>('/comms/dms', { userId }).catch(() => null);
    if (res) {
      setShowNewDm(false);
      await loadOverview();
      setActiveId(res.id);
    }
  };

  const deleteChannel = async (id: string) => {
    await api.delete(`/comms/channels/${id}`).catch(() => {});
    setActiveId(null);
    setThread(null);
    await loadOverview();
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Channels, direct messages and company announcements."
        actions={
          <div className="flex rounded-lg border border-subtle bg-surface p-0.5">
            {[
              { key: 'messages' as const, label: 'Messages', icon: MessageSquare },
              { key: 'announcements' as const, label: 'Announcements', icon: Megaphone },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setTab(option.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-body-sm font-medium transition-colors',
                  tab === option.key ? 'bg-brand-500 text-white' : 'text-secondary hover:text-primary',
                )}
              >
                <option.icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {tab === 'messages' ? (
        <div className="flex h-[calc(100vh-8.5rem)] min-h-0">
          {/* Conversation rail */}
          <aside
            className={cn(
              'w-full shrink-0 overflow-y-auto border-r border-subtle p-2 sm:w-72',
              activeId && 'hidden sm:block',
            )}
          >
            <RailSection
              title="Channels"
              action={
                <button onClick={() => setShowNewChannel(true)} title="New channel" className="text-tertiary hover:text-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            >
              {overview?.channels.map((channel) => (
                <RailItem
                  key={channel.id}
                  active={channel.id === activeId}
                  unread={channel.unread}
                  onClick={() => setActiveId(channel.id)}
                  icon={<Hash className="h-4 w-4 text-tertiary" aria-hidden />}
                  label={channel.name ?? 'channel'}
                />
              ))}
              {overview?.channels.length === 0 && (
                <p className="px-2 py-1 text-caption text-tertiary">No channels yet</p>
              )}
            </RailSection>

            <RailSection
              title="Direct messages"
              action={
                <button onClick={() => setShowNewDm(true)} title="New message" className="text-tertiary hover:text-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            >
              {overview?.dms.map((dm) => (
                <RailItem
                  key={dm.id}
                  active={dm.id === activeId}
                  unread={dm.unread}
                  onClick={() => setActiveId(dm.id)}
                  icon={<Avatar name={dm.user?.name ?? '?'} src={dm.user?.avatarUrl} size="xs" />}
                  label={dm.user?.name ?? 'Direct message'}
                />
              ))}
              {overview?.dms.length === 0 && (
                <p className="px-2 py-1 text-caption text-tertiary">No direct messages</p>
              )}
            </RailSection>
          </aside>

          {/* Thread */}
          <section className={cn('flex min-w-0 flex-1 flex-col', !activeId && 'hidden sm:flex')}>
            {!thread ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState icon={<MessageSquare className="h-6 w-6" aria-hidden />} title="Pick a conversation" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
                  <button className="sm:hidden" onClick={() => setActiveId(null)} aria-label="Back">
                    <ArrowLeft className="h-4 w-4 text-tertiary" aria-hidden />
                  </button>
                  {thread.conversation.type === 'CHANNEL' ? (
                    <>
                      <Hash className="h-4 w-4 text-tertiary" aria-hidden />
                      <span className="text-body-md font-medium text-primary">{thread.conversation.name}</span>
                      {thread.conversation.description && (
                        <span className="truncate text-caption text-tertiary">· {thread.conversation.description}</span>
                      )}
                      {canManageAnnouncements && (
                        <button
                          onClick={() => void deleteChannel(thread.conversation.id)}
                          title="Delete channel"
                          className="ml-auto rounded p-1 text-tertiary hover:bg-danger-bg hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Avatar name={thread.conversation.user?.name ?? '?'} src={thread.conversation.user?.avatarUrl} size="sm" />
                      <span className="text-body-md font-medium text-primary">{thread.conversation.user?.name}</span>
                      {thread.conversation.user?.designation && (
                        <span className="text-caption text-tertiary">· {thread.conversation.user.designation}</span>
                      )}
                    </>
                  )}
                </div>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {thread.messages.length === 0 ? (
                    <p className="py-8 text-center text-body-sm text-tertiary">No messages yet. Say hello 👋</p>
                  ) : (
                    thread.messages.map((message) => {
                      const mine = message.author?.id === user?.id;
                      return (
                        <div key={message.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                          <Avatar name={message.author?.name ?? '?'} src={message.author?.avatarUrl} size="sm" />
                          <div className={cn('max-w-[75%]', mine && 'items-end text-right')}>
                            <div className={cn('flex items-baseline gap-2', mine && 'flex-row-reverse')}>
                              <span className="text-caption font-medium text-secondary">
                                {mine ? 'You' : message.author?.name ?? 'Unknown'}
                              </span>
                              <span className="text-caption text-tertiary">{timeLabel(message.createdAt)}</span>
                            </div>
                            <div
                              className={cn(
                                'mt-1 inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-body-sm',
                                mine ? 'bg-brand-500 text-white' : 'bg-sunken text-primary',
                              )}
                            >
                              {message.body}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-subtle p-3">
                  <div className="flex items-end gap-2">
                    <Textarea
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={
                        thread.conversation.type === 'CHANNEL'
                          ? `Message #${thread.conversation.name}`
                          : `Message ${thread.conversation.user?.name ?? ''}`
                      }
                      className="max-h-32 min-h-0 flex-1 resize-none"
                    />
                    <Button size="icon" onClick={() => void send()} loading={sending} disabled={!draft.trim()} aria-label="Send">
                      <Send className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <AnnouncementsFeed canManage={canManageAnnouncements} currentUserId={user?.id ?? ''} />
      )}

      <NewChannelModal
        open={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        onCreated={async (id) => {
          setShowNewChannel(false);
          await loadOverview();
          setActiveId(id);
        }}
      />
      <NewDmModal open={showNewDm} onClose={() => setShowNewDm(false)} onPick={openDm} />
    </>
  );
}

function RailSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-overline uppercase text-tertiary">{title}</p>
        {action}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function RailItem({
  active,
  unread,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  unread: number;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-body-sm transition-colors',
          active ? 'bg-brand-50 text-brand-600' : 'text-secondary hover:bg-sunken hover:text-primary',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className={cn('flex-1 truncate', unread > 0 && !active && 'font-semibold text-primary')}>{label}</span>
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    </li>
  );
}

function NewChannelModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      setError('A channel name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>('/comms/channels', { name, description: description || undefined });
      await onCreated(res.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the channel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New channel">
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. sales" />
        </Field>
        <Field label="Description (optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this channel for?" />
        </Field>
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NewDmModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (userId: string) => Promise<void> }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      void api.get<Member[]>('/comms/members').then(setMembers).catch(() => setMembers([]));
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? members.filter((m) => m.name.toLowerCase().includes(needle)) : members;
  }, [members, query]);

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <div className="space-y-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teammates…" />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => void onPick(member.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sunken"
              >
                <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-primary">{member.name}</p>
                  <p className="truncate text-caption text-tertiary">{member.designation ?? member.department ?? ''}</p>
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <p className="px-2 py-4 text-center text-body-sm text-tertiary">No teammates found</p>}
        </ul>
      </div>
    </Modal>
  );
}

function AnnouncementsFeed({ canManage, currentUserId }: { canManage: boolean; currentUserId: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setItems(await api.get<Announcement[]>('/comms/announcements').catch(() => []));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pin = async (id: string, isPinned: boolean) => {
    await api.patch(`/comms/announcements/${id}`, { isPinned }).catch(() => {});
    await load();
  };
  const remove = async (id: string) => {
    await api.delete(`/comms/announcements/${id}`).catch(() => {});
    await load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New announcement
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-6 w-6" aria-hidden />} title="No announcements yet" description="Share company news with the whole team." />
      ) : (
        items.map((item) => (
          <AnnouncementCard
            key={item.id}
            item={item}
            canManage={canManage}
            isAuthor={item.author?.id === currentUserId}
            onPin={() => void pin(item.id, !item.isPinned)}
            onDelete={() => void remove(item.id)}
          />
        ))
      )}

      <NewAnnouncementModal
        open={showNew}
        canManage={canManage}
        onClose={() => setShowNew(false)}
        onCreated={async () => {
          setShowNew(false);
          await load();
        }}
      />
    </div>
  );
}

function AnnouncementCard({
  item,
  canManage,
  isAuthor,
  onPin,
  onDelete,
}: {
  item: Announcement;
  canManage: boolean;
  isAuthor: boolean;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  const loadComments = useCallback(async () => {
    setComments(await api.get<Message[]>(`/comms/announcements/${item.id}/comments`).catch(() => []));
  }, [item.id]);

  useEffect(() => {
    if (open) void loadComments();
  }, [open, loadComments]);

  const addComment = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await api.post(`/comms/announcements/${item.id}/comments`, { body: text }).catch(() => {});
    await loadComments();
  };

  return (
    <Card className={cn(item.isPinned && 'border-brand-200')}>
      <CardBody className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {item.isPinned && <Pin className="h-3.5 w-3.5 text-brand-500" aria-hidden />}
            <h3 className="text-body-md font-semibold text-primary">{item.title}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {canManage && (
              <button onClick={onPin} title={item.isPinned ? 'Unpin' : 'Pin'} className="rounded p-1 text-tertiary hover:bg-sunken hover:text-primary">
                <Pin className={cn('h-3.5 w-3.5', item.isPinned && 'fill-brand-500 text-brand-500')} aria-hidden />
              </button>
            )}
            {(canManage || isAuthor) && (
              <button onClick={onDelete} title="Delete" className="rounded p-1 text-tertiary hover:bg-danger-bg hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-body-sm text-secondary">{item.body}</p>

        <div className="mt-3 flex items-center gap-2 text-caption text-tertiary">
          {item.author && <Avatar name={item.author.name} src={item.author.avatarUrl} size="xs" />}
          <span>{item.author?.name ?? 'Unknown'}</span>
          <span>· {format(new Date(item.createdAt), 'd MMM, h:mm a')}</span>
          <button onClick={() => setOpen((v) => !v)} className="ml-auto text-brand-600 hover:underline">
            {item.commentCount > 0 ? `${item.commentCount} comment${item.commentCount === 1 ? '' : 's'}` : 'Comment'}
          </button>
        </div>

        {open && (
          <div className="mt-3 space-y-3 border-t border-subtle pt-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <Avatar name={comment.author?.name ?? '?'} src={comment.author?.avatarUrl} size="xs" />
                <div>
                  <p className="text-caption">
                    <span className="font-medium text-secondary">{comment.author?.name ?? 'Unknown'}</span>{' '}
                    <span className="text-tertiary">{format(new Date(comment.createdAt), 'd MMM, h:mm a')}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-body-sm text-primary">{comment.body}</p>
                </div>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addComment();
                  }
                }}
                placeholder="Add a comment…"
              />
              <Button size="sm" onClick={() => void addComment()} disabled={!draft.trim()}>
                Post
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function NewAnnouncementModal({
  open,
  canManage,
  onClose,
  onCreated,
}: {
  open: boolean;
  canManage: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pin, setPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setBody('');
      setPin(false);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/comms/announcements', { title, body, isPinned: pin });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not post the announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New announcement">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening?" />
        </Field>
        <Field label="Message">
          <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {canManage && (
          <label className="flex items-center gap-2 text-body-sm text-secondary">
            <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
            Pin to the top of the feed
          </label>
        )}
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving}>
            Post
          </Button>
        </div>
      </div>
    </Modal>
  );
}
