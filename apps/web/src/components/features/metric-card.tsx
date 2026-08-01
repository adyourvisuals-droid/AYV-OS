'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * A metric card answers three questions at a glance: what is the number,
 * which way is it moving, and what is the shape of that movement.
 */
export function MetricCard({
  label,
  value,
  change,
  caption,
  trend,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  change?: number | null;
  caption?: ReactNode;
  trend?: { value: number }[];
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const positive = change !== null && change !== undefined && change >= 0;

  const valueTone = {
    neutral: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <Card className="metric p-5">
      <p className="text-overline uppercase text-tertiary">{label}</p>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className={cn('text-display-sm tracking-tight', valueTone)}>{value}</span>
        {change !== null && change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-body-sm font-medium',
              positive ? 'text-success' : 'text-danger',
            )}
          >
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {caption && <p className="mt-1.5 text-body-sm text-secondary">{caption}</p>}

      {trend && trend.length > 1 && <Sparkline points={trend.map((point) => point.value)} />}
    </Card>
  );
}

/**
 * Inline sparkline drawn as an SVG path — no charting library needed for a
 * shape this simple, and it keeps the metric row fast.
 */
function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const width = 100;
  const height = 24;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const rising = points[points.length - 1] >= points[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 h-6 w-full"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={rising ? 'var(--success)' : 'var(--danger)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
