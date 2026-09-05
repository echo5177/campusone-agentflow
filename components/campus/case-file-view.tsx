'use client';

import { CircleDashed } from 'lucide-react';

import { EmptyState, Mono, Panel, Pill, ViewHeader, formatDateTime } from './primitives';
import type { CaseStatus, DemoSnapshot } from './types';
import { statusMeta } from './types';

const actorLabels: Record<string, string> = {
  student: '申请人',
  admin: '管理员',
  system: '系统',
};

function stateLabel(state: string | null) {
  if (!state) return null;
  return statusMeta[state as CaseStatus]?.label ?? state;
}

export function CaseFileView({ snapshot }: { snapshot: DemoSnapshot }) {
  const { events, versions } = snapshot;

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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="不可变时间轴" description="按发生顺序排列，不可编辑。">
          {events.length === 0 ? (
            <EmptyState>尚无事件</EmptyState>
          ) : (
            <ol className="space-y-0">
              {events.map((event, index) => {
                const before = stateLabel(event.beforeState);
                const after = stateLabel(event.afterState);
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
                        <span>{actorLabels[event.actorRole] ?? event.actorRole}</span>
                        <Mono>{event.actorId}</Mono>
                        <Mono>{event.eventType}</Mono>
                      </p>
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

        <Panel title="申请版本" description="退回修订会新增版本。">
          <ul className="space-y-2">
            {versions.map((version) => {
              const current = version.version === snapshot.case.currentVersion;
              return (
                <li
                  key={version.id}
                  className={`rounded-xl border px-3.5 py-3 ${
                    current ? 'border-brand-200 bg-brand-50/60' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-medium">
                      版本 V<span data-numeric>{version.version}</span>
                    </p>
                    {current && <Pill tone="active">当前</Pill>}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                    <Mono>{version.createdBy}</Mono>
                    <time>{formatDateTime(version.createdAt)}</time>
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
