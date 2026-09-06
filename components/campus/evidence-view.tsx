'use client';

import { isStaticDemo } from '@/lib/client/api';


import { CheckCircle2, ShieldCheck } from 'lucide-react';

import { EmptyState, Panel, Pill, ViewHeader, formatDateTime } from './primitives';
import type { DemoSnapshot } from './types';
import { agentTaskLabels } from './types';

export function EvidenceView({ snapshot }: { snapshot: DemoSnapshot }) {
  const runs = snapshot.aiRuns;
  const rejected = runs.filter((run) => run.validationStatus !== 'passed').length;

  const controls: Array<{ label: string; value: string; ready: boolean }> = [
    { label: '表单 Schema', value: 'V1.2', ready: true },
    {
      label: '场地规则集',
      value: `${snapshot.rules.length} 条 · ${snapshot.rules[0]?.version ?? '—'}`,
      ready: snapshot.rules.length > 0,
    },
    {
      label: '知识库条目',
      value: `${snapshot.knowledge.length} 份`,
      ready: snapshot.knowledge.length > 0,
    },
    {
      label: '最近模型输出验证',
      value: runs[0]?.validationStatus ?? '等待运行',
      ready: runs[0]?.validationStatus === 'passed',
    },
  ];

  return (
    <div className="space-y-5">
      <ViewHeader
        title="AI 运行证据"
        description={isStaticDemo ? "记录本地 Mock 的任务、模板版本、处理耗时、验证状态与错误码。被拦下的输出也会留下记录，方便查看校验效果。" : "每一次模型调用都留痕：任务、提示词版本、模型、耗时、验证状态与错误码。被拦下的输出同样保留，用来证明校验真的发生过。不保存 API Key。"}
        actions={
          <div className="flex gap-2">
            <Pill tone="active">
              <span data-numeric>{runs.length}</span> 次运行
            </Pill>
            <Pill tone={rejected > 0 ? 'fail' : 'neutral'}>
              <span data-numeric>{rejected}</span> 次被拒绝
            </Pill>
          </div>
        }
      />

      <Panel title="运行记录" description="按时间倒序，最多显示最近 20 条。">
        {runs.length === 0 ? (
          <EmptyState>尚无 AI 运行记录</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="pb-2.5 pr-4 font-semibold">任务</th>
                  <th className="pb-2.5 pr-4 font-semibold">提示词</th>
                  <th className="pb-2.5 pr-4 font-semibold">模型</th>
                  <th className="pb-2.5 pr-4 font-semibold">耗时</th>
                  <th className="pb-2.5 pr-4 font-semibold">验证</th>
                  <th className="pb-2.5 font-semibold">时间</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 20).map((run) => {
                  const passed = run.validationStatus === 'passed';
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-3 pr-4 text-[13px]">
                        {agentTaskLabels[run.taskType] ?? run.taskType}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">
                        {run.promptVersion}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">
                        {run.model}
                      </td>
                      <td
                        className="py-3 pr-4 font-mono text-[12px] text-muted-foreground"
                        data-numeric
                      >
                        {run.latencyMs}ms
                      </td>
                      <td className="py-3 pr-4">
                        <Pill tone={passed ? 'done' : 'fail'}>
                          {passed ? '已通过' : (run.errorCode ?? '已拒绝')}
                        </Pill>
                      </td>
                      <td className="py-3 text-[12px] text-muted-foreground">
                        <time>{formatDateTime(run.createdAt)}</time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="可信控制状态"
        description={isStaticDemo ? "演示状态由本地规则与人工操作改变。记录保存在浏览器，可通过重置清除。" : "正式状态只由后端规则与人工操作改变。"}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {controls.map((control) => (
            <div
              key={control.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium">
                {control.ready ? (
                  <CheckCircle2 className="size-4 text-pass" aria-hidden="true" />
                ) : (
                  <ShieldCheck
                    className="size-4 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                )}
                {control.label}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {control.value}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
