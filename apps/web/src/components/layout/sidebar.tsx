'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CheckSquare,
  FileSignature,
  FileText,
  FolderKanban,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Palette,
  Receipt,
  Settings,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PERMISSIONS } from '@ayv/types';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the principal holds at least one of these. */
  permissions?: string[];
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * Navigation is filtered by permission, not merely disabled — a Designer
 * never sees that a Finance section exists.
 */
const NAV: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Pipeline', href: '/crm/pipeline', icon: Target, permissions: [PERMISSIONS.LEAD_READ] },
      { label: 'Leads', href: '/crm/leads', icon: Gauge, permissions: [PERMISSIONS.LEAD_READ] },
      {
        label: 'Follow-ups',
        href: '/crm/leads/follow-ups',
        icon: CalendarCheck2,
        permissions: [PERMISSIONS.LEAD_READ],
      },
      { label: 'Quotations', href: '/crm/quotations', icon: FileText, permissions: [PERMISSIONS.QUOTATION_READ] },
      { label: 'Contracts', href: '/crm/contracts', icon: FileSignature, permissions: [PERMISSIONS.CONTRACT_READ] },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban, permissions: [PERMISSIONS.PROJECT_READ] },
      { label: 'My tasks', href: '/tasks', icon: CheckSquare, permissions: [PERMISSIONS.TASK_READ] },
      { label: 'Creative', href: '/creative', icon: Palette, permissions: [PERMISSIONS.CREATIVE_READ] },
    ],
  },
  {
    label: 'Clients',
    items: [
      { label: 'Accounts', href: '/clients', icon: Building2, permissions: [PERMISSIONS.CLIENT_READ] },
      { label: 'Health', href: '/clients/health', icon: HeartPulse, permissions: [PERMISSIONS.CLIENT_HEALTH_READ] },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Finance', href: '/finance', icon: Receipt, permissions: [PERMISSIONS.INVOICE_READ] },
      { label: 'People', href: '/people', icon: Users, permissions: [PERMISSIONS.EMPLOYEE_READ] },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, permissions: [PERMISSIONS.REPORT_READ] },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'AI Center', href: '/ai', icon: Sparkles, permissions: [PERMISSIONS.AI_USE] },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user, canAny } = useAuth();

  const visibleSections = NAV.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permissions || canAny(...item.permissions),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-subtle bg-surface',
        'transition-[width] duration-200 ease-smooth',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[13px] font-bold text-white">
          A
        </div>
        {!collapsed && (
          <span className="truncate text-heading-sm tracking-tight text-primary">AYV OS</span>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {visibleSections.map((section, index) => (
          <div key={section.label ?? index}>
            {section.label && !collapsed && (
              <p className="px-2.5 pb-1.5 text-overline uppercase text-tertiary">{section.label}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2',
                        'text-body-sm font-medium transition-colors duration-100',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-secondary hover:bg-sunken hover:text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user && (
        <div className="border-t border-subtle p-3">
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
              {user.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-primary">{user.name}</p>
                <p className="truncate text-caption text-tertiary">
                  {user.role.key.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
