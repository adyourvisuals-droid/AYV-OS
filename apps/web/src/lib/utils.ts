import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Indian-format currency. Agency figures are read in lakhs and crores, so
 * large numbers abbreviate rather than sprawling across a metric card.
 */
export function formatCurrency(value: number, options: { compact?: boolean } = {}): string {
  const { compact = false } = options;

  if (compact) {
    if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`;
    if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(2)}L`;
    if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  }

  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(value: string | Date | null, style: 'short' | 'long' = 'short'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' } : {}),
  });
}

/** "in 3 days" / "2 hours ago" — the phrasing an operator actually scans for. */
export function formatRelative(value: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffMs) < 3_600_000) {
    const minutes = Math.round(diffMs / 60_000);
    if (Math.abs(minutes) < 1) return 'just now';
    return minutes > 0 ? `in ${minutes}m` : `${Math.abs(minutes)}m ago`;
  }

  if (Math.abs(diffDays) < 1) {
    const hours = Math.round(diffMs / 3_600_000);
    return hours > 0 ? `in ${hours}h` : `${Math.abs(hours)}h ago`;
  }

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Maps a 0–100 health score to the semantic band used across the UI. */
export function healthBand(score: number): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
} {
  if (score >= 80) return { label: 'Healthy', tone: 'success' };
  if (score >= 60) return { label: 'Stable', tone: 'info' };
  if (score >= 40) return { label: 'At risk', tone: 'warning' };
  return { label: 'Critical', tone: 'danger' };
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
