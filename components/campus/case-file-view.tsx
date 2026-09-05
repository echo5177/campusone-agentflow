'use client';

import { useState } from 'react';
import { ArrowRight, CircleDashed, MessageSquareText } from 'lucide-react';

import {
  EmptyState,
  Mono,
  Panel,
  Pill,
  ViewHeader,
  formatDateTime,
} from './primitives';
import type { CaseStatus, DemoSnapshot, VenueApplication } from './types';
import { comparableFields, statusMeta } from './types';

const actorLabels: Record<string, string> = {
  student: '申请人',
  admin: '管理员',
  system: '系统',
};

function stateLabel(state: string | null) {
  if (!state) return null;
  return statusMeta[state as CaseStatus]?.label ?? state;
}

/**
 * Renders one application field as the text a reviewer reads — the venue as its
 * name rather than the `activity-center` key the form stores.
 */
function fieldText(
  application: VenueApplication,
  key: keyof VenueApplication,
  venues: DemoSnapshot['venues'],
) {
  const value = application[key];
  if (key === 'venueId') {
    return venues.find((venue) => venue.id === value)?.name ?? String(value);
  }
  if (Array.isArray(value)) return value.join('、');
  if (key === 'startTime' || key === 'endTime') return formatDateTime(String(value));
  if (key === 'attendees') return `${String(value)} 人`;
  return String(value);
}

export function CaseFileView({ snapshot }: { snapshot: DemoSnapshot }) {
  const { events, versions } = snapshot;
  // Newest first, matching the list order the reader sees.
  const [selectedVersion, setSelectedVersion] = useState(
    snapshot.case.currentVersion,
  );

  const selected =
    versions.find((item) => item.version === selectedVersion) ?? versions[0];
  const previous = versions.find(
    (item) => item.version === (selected?.version ?? 0) - 1,
  );

  const changedKeys = new Set(
    previous && selected
      ? comparableFields
          .filter(
            ({ key }) =>
              fieldText(selected.formData, key, snapshot.venues) !==
              fieldText(previous.formData, key, snapshot.venues),
          )
          .map(({ key }) => key)
      : [],
  );

  return (
    <div className="space-y-5">
      <ViewHeader
        title="事务档案"
        description="每一次状态变化都带着操作角色、前后状态和服务端推导的幂等键写入后端；退回后的修订生成新版本，旧版本不被覆盖。"
        actions={
          <div className="flex gap-2">
            <Pill tone="active">
              <span data-numeric>{events.length}</span> 条事件
            </Pill>
            <Pill tone="neutral">
              <span data-numeric>{versions.length}</span> 个版本
            </Pill>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel title="不可变时间轴" description="按发生顺序排列，不可编辑。">
          {events.length === 0 ? (
            <EmptyState>尚无事件</EmptyState>
          ) : (
            <ol className="space-y-0">
              {events.map((event, index) => {
                const before = stateLabel(event.beforeState);
                const after = stateLabel(event.afterState);
                const reason =
                  typeof event.metadata?.reason === 'string'
                    ? event.metadata.reason
                    : null;
                return (
                  <li
                    key={event.id}
                    className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-3 py-3"
                  >
                    <div className="relative grid size-[26px] place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                      <CircleDashed className="size-3.5" aria-hidden="true" />
                      {index < events.length - 1 && (
                        <span className="absolute top-[26px] h-[calc(100%+4px)] w-px bg-border" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium">
                        {before ? `${before} → ${after}` : '创建申请'}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                        <span>
                          {actorLabels[event.actorRole] ?? event.actorRole}
                        </span>
                        <Mono>{event.actorId}</Mono>
                        <Mono>{event.eventType}</Mono>
                      </p>
                      {reason && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warn-line bg-warn-soft px-2.5 py-1.5 text-[12px] leading-[1.7] text-foreground">
                          <MessageSquareText
                            className="mt-0.5 size-3.5 shrink-0 text-warn"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-medium text-warn">退回意见：</span>
                            {reason}
                          </span>
                        </p>
                      )}
                    </div>
                    <time className="pt-0.5 text-[12px] text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title="申请版本" description="选择一个版本查看正文。">
          <ul className="space-y-2">
            {versions.map((version) => {
              const current = version.version === snapshot.case.currentVersion;
              const active = version.version === selected?.version;
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedVersion(version.version)}
                    className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      active
                        ? 'border-brand-300 bg-brand-50/70'
                        : 'border-border bg-card hover:border-brand-200'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium">
                        版本 V<span data-numeric>{version.version}</span>
                      </span>
                      {current && <Pill tone="active">当前</Pill>}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                      <Mono>{version.createdBy}</Mono>
                      <time>{formatDateTime(version.createdAt)}</time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {selected && (
        <Panel
          title={`版本 V${selected.version} 正文`}
          description={
            previous
              ? `与 V${previous.version} 逐字段对照；变化的字段标出修改前后。`
              : '首个版本，没有可对照的上一版。查看不会修改任何版本。'
          }
          aside={
            previous && (
              <Pill tone={changedKeys.size > 0 ? 'warn' : 'neutral'}>
                {changedKeys.size > 0
                  ? `${changedKeys.size} 个字段有变化`
                  : '与上一版一致'}
              </Pill>
            )
          }
        >
          <dl className="grid gap-2.5 lg:grid-cols-2">
            {comparableFields.map(({ key, label }) => {
              const changed = changedKeys.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3.5 ${
                    changed
                      ? 'border-warn-line bg-warn-soft/60'
                      : 'border-border bg-card'
                  } ${key === 'description' ? 'lg:col-span-2' : ''}`}
                >
                  <dt className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {label}
                    {changed && <Pill tone="warn">已修改</Pill>}
                  </dt>
                  <dd className="mt-1.5 text-[13px] leading-[1.75]">
                    {changed && previous ? (
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                          {fieldText(previous.formData, key, snapshot.venues)}
                        </span>
                        <ArrowRight
                          className="size-3.5 shrink-0 text-warn"
                          aria-hidden="true"
                        />
                        <span className="font-medium">
                          {fieldText(selected.formData, key, snapshot.venues)}
                        </span>
                      </span>
                    ) : (
                      fieldText(selected.formData, key, snapshot.venues)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Panel>
      )}
    </div>
  );
}
