'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';
import { LogOut, Moon, PanelLeft, Search, Sun } from 'lucide-react';

import { Button, Kbd } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

import { CommandPalette } from './command-palette';
import { NotificationCenter } from './notification-center';
import { Sidebar } from './sidebar';

const SIDEBAR_KEY = 'ayv.sidebarCollapsed';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === 'true');
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Global shortcuts. ⌘K opens the palette, ⌘B toggles the sidebar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setCollapsed((value) => {
          window.localStorage.setItem(SIDEBAR_KEY, String(!value));
          return !value;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas print:h-auto print:overflow-visible">
      <div className="hidden md:block print:hidden">
        <Sidebar collapsed={collapsed} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-subtle px-4 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCollapsed((value) => {
                window.localStorage.setItem(SIDEBAR_KEY, String(!value));
                return !value;
              });
            }}
            aria-label="Toggle sidebar"
            className="hidden md:inline-flex"
          >
            <PanelLeft className="h-4 w-4" aria-hidden />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 max-w-md flex-1 items-center gap-2.5 rounded-md border border-subtle bg-surface px-3 text-left text-body-sm text-tertiary transition-colors hover:border-strong"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="flex-1 truncate">Search or ask AI…</span>
            <Kbd>⌘K</Kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <NotificationCenter />

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden />
                )}
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-subtle px-6 py-5">
      <div className="min-w-0">
        <h1 className="text-heading-lg text-primary">{title}</h1>
        {subtitle && <div className="mt-1 text-body-sm text-secondary">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
