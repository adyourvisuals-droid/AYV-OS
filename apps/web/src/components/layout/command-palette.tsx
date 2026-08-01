'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Create' | 'Ask AI';
  icon: LucideIcon;
  shortcut?: string;
  run: (router: ReturnType<typeof useRouter>) => void;
}

const COMMANDS: Command[] = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', group: 'Navigate', icon: LayoutDashboard, shortcut: '⌘⇧D', run: (r) => r.push('/dashboard') },
  { id: 'nav-pipeline', label: 'Go to Pipeline', group: 'Navigate', icon: Target, run: (r) => r.push('/crm/pipeline') },
  { id: 'nav-projects', label: 'Go to Projects', group: 'Navigate', icon: FolderKanban, run: (r) => r.push('/projects') },
  { id: 'nav-clients', label: 'Go to Clients', group: 'Navigate', icon: Building2, run: (r) => r.push('/clients') },
  { id: 'new-lead', label: 'New lead', hint: 'Capture an enquiry', group: 'Create', icon: Plus, shortcut: '⌘⇧L', run: (r) => r.push('/crm/leads?new=1') },
  { id: 'new-project', label: 'New project', group: 'Create', icon: Plus, run: (r) => r.push('/projects?new=1') },
  { id: 'ai-risk', label: 'Which clients are at risk?', group: 'Ask AI', icon: Sparkles, run: (r) => r.push('/clients/health') },
  { id: 'ai-forecast', label: 'What is my weighted forecast?', group: 'Ask AI', icon: Sparkles, run: (r) => r.push('/dashboard') },
];

/**
 * ⌘K — the single most important interaction in the product.
 *
 * Navigate, create, or ask. Arrow keys move, Enter runs, Escape closes.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.group.toLowerCase().includes(needle),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus after the open animation begins, or the caret jumps.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % Math.max(1, results.length));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + results.length) % Math.max(1, results.length));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const command = results[activeIndex];
        if (command) {
          command.run(router);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, results, activeIndex, router, onClose]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, Command[]>>((accumulator, command) => {
    (accumulator[command.group] ??= []).push(command);
    return accumulator;
  }, {});

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl animate-scale-in overflow-hidden rounded-xl border border-subtle bg-raised shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 border-b border-subtle px-4">
          <Search className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or type a command…"
            className="h-12 flex-1 bg-transparent text-body-md text-primary outline-none placeholder:text-tertiary"
            aria-label="Command input"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-body-sm text-tertiary">
              No matches for “{query}”
            </p>
          ) : (
            Object.entries(grouped).map(([group, commands]) => (
              <div key={group} className="mb-1">
                <p className="px-3 py-1.5 text-overline uppercase text-tertiary">{group}</p>
                {commands.map((command) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const Icon = command.icon;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        command.run(router);
                        onClose();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                        'transition-colors duration-100',
                        isActive ? 'bg-brand-50 text-brand-600' : 'text-secondary',
                      )}
                    >
                      <Icon
                        className={cn('h-4 w-4 shrink-0', group === 'Ask AI' && 'text-ai')}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-body-sm font-medium">
                        {command.label}
                        {command.hint && (
                          <span className="ml-2 font-normal text-tertiary">{command.hint}</span>
                        )}
                      </span>
                      {command.shortcut ? (
                        <Kbd>{command.shortcut}</Kbd>
                      ) : (
                        isActive && <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
