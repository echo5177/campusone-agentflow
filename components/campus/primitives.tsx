'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { CAMPUS_TIME_ZONE } from '@/lib/domain/time';

/** Timestamps are pinned to the campus clock so a viewer's timezone cannot shift
 *  a rendered time away from the one the rules were evaluated against. */
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CAMPUS_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function formatClock(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CAMPUS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function formatSlot(startTime: string, endTime: string) {
  const day = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CAMPUS_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startTime));
  return `${day} ${formatClock(startTime)}–${formatClock(endTime)}`;
}

export { fetchJson } from '@/lib/client/api';

/** Adds the campus offset the API expects to a `datetime-local` value. */
export function applicationForRequest<T extends { startTime: string; endTime: string }>(
  application: T,
): T {
  const withOffset = (value: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+08:00` : value;
  return {
    ...application,
    startTime: withOffset(application.startTime),
    endTime: withOffset(application.endTime),
  };
}

const pillTones = {
  neutral: 'bg-muted text-muted-foreground ring-border',
  active: 'bg-brand-50 text-brand-800 ring-brand-200',
  warn: 'bg-warn-soft text-warn ring-warn-line',
  done: 'bg-pass-soft text-pass ring-pass-line',
  fail: 'bg-fail-soft text-fail ring-fail-line',
} as const;

export function Pill({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: keyof typeof pillTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${pillTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A monospace identifier — rule ids, evidence refs, error codes, case numbers. */
export function Mono({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      className={`rounded bg-muted px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground ${className}`}
    >
      {children}
    </code>
  );
}

export function ViewHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[21px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.7] text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  description,
  aside,
  children,
  className = '',
  id,
}: {
  title?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-border bg-card shadow-card ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-[12.5px] leading-[1.7] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {aside}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
      {children}
    </p>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3.5">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[13px]">
          {label}
        </Label>
        {hint && (
          <span className="text-[11.5px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
