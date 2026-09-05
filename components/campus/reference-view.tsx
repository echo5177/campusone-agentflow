'use client';

import { Panel, Pill, ViewHeader, formatSlot } from './primitives';
import type { AiPresentation, DemoSnapshot, VenueApplication } from './types';

export function ReferenceView({
  snapshot,
  application,
  presentation,
}: {
  snapshot: DemoSnapshot;
  application: VenueApplication;
  presentation: AiPresentation | null;
}) {
  const cited = new Set(presentation?.result.knowledge.map((item) => item.id) ?? []);

  return (
    <div className="space-y-5">
      <ViewHeader
        title="规则与知识"
        description="规则表、知识库与场地事实是同一份数据的三个视图：规则引擎按它们判定，AI 只被允许读取当前任务命中的条目，并且只能引用这里存在的编号。"
        actions={
          <div className="flex gap-2">
            <Pill tone="active">
              <span data-numeric>{snapshot.rules.length}</span> 条规则
            </Pill>
            <Pill tone="neutral">
              <span data-numeric>{snapshot.knowledge.length}</span> 份制度
            </Pill>
          </div>
        }
      />

      <Panel
        title="确定性规则集"
        description="容量、时间、冲突与开放时间全部由程序判定，模型不参与。"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="pb-2.5 pr-4 font-semibold">规则编号</th>
                <th className="pb-2.5 pr-4 font-semibold">判定内容</th>
                <th className="pb-2.5 pr-4 font-semibold">版本</th>
                <th className="pb-2.5 font-semibold">来源</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4">
                    <code className="font-mono text-[12px] text-brand-800">
                      {rule.id}
                    </code>
                  </td>
                  <td className="py-3 pr-4 text-[13px]">{rule.label}</td>
                  <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">
                    {rule.version}
                  </td>
                  <td className="py-3 text-[12.5px] text-muted-foreground">
                    {rule.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="场地开放时间与已占用时段"
          description="VENUE-HOUR-001 与 VENUE-SLOT-001 判定所依据的事实，全部为模拟数据。"
        >
          <div className="space-y-2.5">
            {snapshot.venues.map((item) => {
              const taken = snapshot.bookings.filter(
                (booking) => booking.venueId === item.id,
              );
              const selected = item.id === application.venueId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 ${
                    selected ? 'border-brand-200 bg-brand-50/60' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13.5px] font-medium">{item.name}</p>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {item.availableFrom}–{item.availableTo}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    容量 <span data-numeric>{item.capacity}</span> 人 ·{' '}
                    {item.equipment.join('、')}
                  </p>
                  {taken.length === 0 ? (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      暂无已占用时段
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {taken.map((booking) => (
                        <li
                          key={booking.title}
                          className="text-[12px] leading-[1.7] text-fail"
                        >
                          已占用 {formatSlot(booking.startTime, booking.endTime)} ·{' '}
                          {booking.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="场地事务知识库"
          description="每条规则都绑定制度依据；AI 只能读取当前任务命中的条目。"
        >
          <div className="space-y-2.5">
            {snapshot.knowledge.map((document) => {
              const isCited = cited.has(document.id);
              return (
                <div
                  key={document.id}
                  className={`rounded-xl border p-3.5 ${
                    isCited ? 'border-brand-300 bg-brand-50/70' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[13.5px] font-medium">{document.title}</p>
                    {isCited && <Pill tone="active">本次已引用</Pill>}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-[1.75] text-muted-foreground">
                    {document.content}
                  </p>
                  <p className="mt-2 font-mono text-[11.5px] text-muted-foreground/80">
                    {document.id} · {document.source}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
