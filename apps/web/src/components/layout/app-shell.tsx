'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, Menu, Moon, PanelLeft, Search, Sun, X } from 'lucide-react';

import { Avatar, Button, Kbd } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === 'true');
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // The mobile drawer is a route-level overlay; close it whenever the viewport
  // grows back to the desktop breakpoint so it never lingers invisibly.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = () => media.matches && setDrawerOpen(false);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

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
      {/* Desktop sidebar */}
      <div className="hidden md:block print:hidden">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] animate-slide-in-left shadow-lg">
            <div className="relative h-full">
              <Sidebar collapsed={false} onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute right-2 top-3.5 rounded-md p-1.5 text-tertiary hover:bg-sunken hover:text-primary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-subtle px-3 sm:px-4 print:hidden">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </Button>

          {/* Desktop sidebar toggle */}
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
            className="flex h-9 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-subtle bg-surface px-3 text-left text-body-sm text-tertiary transition-colors hover:border-strong"
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

            <UserMenu
              name={user.name}
              roleLabel={user.role.key.replace(/_/g, ' ').toLowerCase()}
              onSignOut={() => void logout()}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

/** Avatar button that opens a small menu with the signed-in identity and sign-out. */
function UserMenu({
  name,
  roleLabel,
  onSignOut,
}: {
  name: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'ml-1 rounded-full ring-2 ring-transparent transition-all hover:ring-brand-200',
          open && 'ring-brand-200',
        )}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar name={name} size="md" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-56 animate-scale-in overflow-hidden rounded-xl border border-subtle bg-raised shadow-lg">
          <div className="border-b border-subtle px-4 py-3">
            <p className="truncate text-body-sm font-medium text-primary">{name}</p>
            <p className="truncate text-caption capitalize text-tertiary">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-body-sm text-secondary transition-colors hover:bg-sunken hover:text-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
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
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-subtle px-4 py-4 sm:px-6 sm:py-5">
      <div className="min-w-0">
        <h1 className="text-heading-lg text-primary">{title}</h1>
        {subtitle && <div className="mt-1 text-body-sm text-secondary">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
