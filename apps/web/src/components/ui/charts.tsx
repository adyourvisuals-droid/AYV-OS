'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/utils';

export interface ChartPoint {
  label: string;
  value: number;
}

/** Smooth cardinal-spline path through the points (tension 0.5). */
function smoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`;

  let d = `M${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * A responsive area/line chart drawn as inline SVG — a gradient fill under a
 * smooth line, a soft baseline grid, hover dots with a value tooltip, and
 * x-axis labels. No charting dependency: this keeps pages fast and themes it
 * entirely through design tokens.
 */
export function AreaChart({
  points,
  height = 200,
  color = 'var(--brand-500)',
  format = (value: number) => String(Math.round(value)),
  className,
  showAxis = true,
}: {
  points: ChartPoint[];
  height?: number;
  color?: string;
  format?: (value: number) => string;
  className?: string;
  showAxis?: boolean;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const width = 720;
  const padX = 8;
  const padTop = 16;
  const padBottom = showAxis ? 26 : 8;

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const xAt = (index: number) =>
    padX + (index / Math.max(1, points.length - 1)) * (width - 2 * padX);
  const yAt = (value: number) =>
    padTop + (1 - (value - min) / range) * (height - padTop - padBottom);

  const coords = points.map((point, index) => ({ x: xAt(index), y: yAt(point.value) }));
  const line = smoothPath(coords);
  const area = coords.length
    ? `${line} L${coords[coords.length - 1].x},${height - padBottom} L${coords[0].x},${height - padBottom} Z`
    : '';

  // A few horizontal grid lines for scale reference.
  const gridYs = [0.25, 0.5, 0.75].map((t) => padTop + t * (height - padTop - padBottom));

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridYs.map((y) => (
          <line
            key={y}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="var(--border-subtle)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Hover columns — invisible hit targets that reveal the active dot. */}
        {coords.map((coord, index) => (
          <rect
            key={index}
            x={index === 0 ? 0 : (coords[index - 1].x + coord.x) / 2}
            y={0}
            width={
              index === 0
                ? (coords[1]?.x ?? coord.x + 1) / 2
                : (( (coords[index + 1]?.x ?? coord.x) - coords[index - 1].x) / 2)
            }
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(index)}
          />
        ))}

        {active !== null && coords[active] && (
          <>
            <line
              x1={coords[active].x}
              x2={coords[active].x}
              y1={padTop}
              y2={height - padBottom}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity="0.5"
            />
            <circle cx={coords[active].x} cy={coords[active].y} r="4" fill={color} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      {/* Tooltip (HTML, so it scales crisply regardless of the SVG stretch). */}
      {active !== null && points[active] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-subtle bg-raised px-2 py-1 text-caption shadow-md"
          style={{ left: `${(xAt(active) / width) * 100}%`, top: 8 }}
        >
          <span className="metric font-medium text-primary">{format(points[active].value)}</span>
          <span className="ml-1 text-tertiary">{points[active].label}</span>
        </div>
      )}

      {showAxis && (
        <div className="mt-1 flex justify-between px-1">
          {points.map((point, index) => (
            <span
              key={index}
              className={cn(
                'text-caption text-tertiary',
                points.length > 8 && index % 2 !== 0 && 'hidden sm:inline',
              )}
            >
              {point.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A donut chart for a small set of categories — segments drawn as stroked
 * circle arcs. The center slot holds a headline number.
 */
export function DonutChart({
  segments,
  size = 132,
  thickness = 14,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const dash = fraction * circumference;
    const arc = { ...segment, dash, gap: circumference - dash, dashOffset: -offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-sunken)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          arcs.map((arc, index) => (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
            />
          ))}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="metric text-heading-md font-semibold text-primary">{centerValue}</span>}
          {centerLabel && <span className="text-caption text-tertiary">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
