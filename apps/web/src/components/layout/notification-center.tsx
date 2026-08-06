'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  readAt: string | null;
  createdAt: string;
}

const SEVERITY_DOT: Record<string, string> = {
  INFO: 'bg-info',
  WARNING: 'bg-warning',
  DANGER: 'bg-danger',
  SUCCESS: 'bg-success',
};

/**
 * The bell and its panel. Polls the unread count on a timer (so the badge
 * stays live), and loads the full list only when opened — no point fetching
 * bodies nobody is looking at every 60 seconds.
 */
export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnread = useCallback(async () => {
    try {
      const result = await api.getWithMeta<unknown[]>('/notifications?limit=1&unread=true');
      setUnread(Number(result.meta.unread ?? 0));
    } catch {
      // A failing badge count must never break the shell.
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getWithMeta<Notification[]>('/notifications?limit=20');
      setItems(result.data);
      setUnread(Number(result.meta.unread ?? 0));
    } catch {
      // Leave whatever was already shown.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadList();
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await api.patch('/notifications', {});
    } catch {
      void loadList();
    }
  };

  const openNotification = async (notification: Notification) => {
    setOpen(false);
    if (!notification.readAt) {
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)),
      );
      setUnread((count) => Math.max(0, count - 1));
      api.patch('/notifications', { ids: [notification.id] }).catch(() => undefined);
    }
    if (notification.link) router.push(notification.link);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative" onClick={toggle}>
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 animate-scale-in overflow-hidden rounded-xl border border-subtle bg-raised shadow-lg">
          <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
            <p className="text-body-sm font-semibold text-primary">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-caption text-brand-600 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-body-sm text-tertiary">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-body-sm text-tertiary">You're all caught up.</p>
            ) : (
              items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={cn(
                    'flex w-full gap-2.5 border-b border-subtle px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-sunken/60',
                    !notification.readAt && 'bg-brand-50/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      notification.readAt ? 'bg-transparent' : SEVERITY_DOT[notification.severity] ?? 'bg-brand-500',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-primary">{notification.title}</p>
                    {notification.body && (
                      <p className="truncate text-caption text-secondary">{notification.body}</p>
                    )}
                    <p className="mt-0.5 text-caption text-tertiary">{formatRelative(notification.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
