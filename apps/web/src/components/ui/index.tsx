'use client';

import { Loader2 } from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn, initialsOf } from '@/lib/utils';

// ─── Button ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-xs',
  secondary: 'bg-surface text-primary border border-subtle hover:bg-sunken',
  ghost: 'text-secondary hover:bg-sunken hover:text-primary',
  danger: 'bg-danger text-white hover:opacity-90',
  ai: 'bg-ai-bg text-ai border border-ai/20 hover:bg-ai/15',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-sm gap-1.5',
  md: 'h-9 px-4 text-body-md gap-2',
  lg: 'h-11 px-6 text-body-md gap-2',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-all duration-150 ease-smooth',
        'disabled:opacity-50 disabled:pointer-events-none',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'bg-surface border border-subtle rounded-lg shadow-sm',
        interactive && 'transition-shadow duration-150 ease-smooth hover:shadow-md cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-heading-sm text-primary', className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

// ─── Badge ─────────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'ai';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-secondary border-subtle',
  success: 'bg-success-bg text-success border-success/20',
  warning: 'bg-warning-bg text-warning border-warning/20',
  danger: 'bg-danger-bg text-danger border-danger/20',
  info: 'bg-info-bg text-info border-info/20',
  brand: 'bg-brand-50 text-brand-600 border-brand-500/20',
  ai: 'bg-ai-bg text-ai border-ai/20',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border',
        'text-caption whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-[11px]',
    lg: 'h-10 w-10 text-body-sm',
  };

  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-brand-100 text-brand-700 font-semibold select-none',
        'ring-2 ring-surface overflow-hidden',
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
}: {
  people: { name: string; avatarUrl?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex -space-x-2">
      {shown.map((person, index) => (
        <Avatar key={`${person.name}-${index}`} name={person.name} src={person.avatarUrl} size="sm" />
      ))}
      {overflow > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sunken text-[10px] font-semibold text-secondary ring-2 ring-surface">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-subtle bg-surface px-3',
          'text-body-md text-primary placeholder:text-tertiary',
          'transition-colors duration-150',
          'focus:border-brand-500 focus:outline-none',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

// ─── Progress ──────────────────────────────────────────────────────────────

export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number;
  /** Mirrors the semantic status scale, including `info` for the 60–79 health band. */
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    brand: 'bg-brand-500',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  };

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300 ease-smooth', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ─── Skeleton / Empty / Error ──────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sunken text-tertiary">
          {icon}
        </div>
      )}
      <p className="text-heading-sm text-primary">{title}</p>
      {description && <p className="mt-1 max-w-sm text-body-sm text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-heading-sm text-danger">Something went wrong</p>
      <p className="mt-1 max-w-sm text-body-sm text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ─── Kbd ───────────────────────────────────────────────────────────────────

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-subtle bg-sunken px-1.5 font-sans text-[10px] font-medium text-tertiary">
      {children}
    </kbd>
  );
}
