'use client';

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  LoaderCircle,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { formatDateTime } from './primitives';
import type {
  AiPresentation,
  CitedKnowledge,
  DemoSnapshot,
  FaultMode,
  ValidationState,
  Venue,
  VenueApplication,
} from './types';

const faultOptions: Array<{ value: FaultMode; label: string }> = [
  { value: 'none', label: '正常输出' },
  { value: 'invalid_json', label: '非法 JSON' },
  { value: 'rule_999', label: '虚构规则' },
  { value: 'timeout', label: '模型超时' },
];

function KnowledgeTrail({ knowledge }: { knowledge: CitedKnowledge[] }) {
  if (knowledge.length === 0) return null;
  return (
    <div className="mt-3.5 border-t border-white/10 pt-3">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
        本次检索到的知识依据
      </p>
      <ul className="mt-2 space-y-1">
        {knowledge.map((document) => (
          <li key={document.id} className="text-[12px] leading-[1.7] text-slate-300">
            <span className="font-mono text-brand-300">{document.id}</span> ·{' '}
            {document.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Model, latency and mode for one run — the line that makes a claim checkable. */
function RunMeta({
  result,
}: {
  result: { latencyMs: number; model: string; mode: 'mock' | 'live' };
}) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/10 pt-3 font-mono text-[11.5px] text-slate-500">
      <span className={result.mode === 'live' ? 'text-brand-300' : 'text-slate-400'}>
        {result.mode === 'live' ? 'LIVE' : 'MOCK'}
      </span>
      <span>{result.model}</span>
      <span data-numeric>{result.latencyMs}ms</span>
    </p>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  status,
  ok,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  status: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-400/12 text-brand-300">
        <Icon className="size-[17px]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-slate-400">{label}</p>
        <p className="truncate text-[13.5px] font-medium">{value}</p>
      </div>
      <span
        className={`shrink-0 text-[11.5px] ${ok ? 'text-brand-300' : 'text-amber-300'}`}
      >
        {status}
      </span>
    </div>
  );
}

export function AiConsole({
  application,
  venue,
  validation,
  snapshot,
  presentation,
  faultMode,
  onFaultModeChange,
  onRun,
  onAdopt,
  busy,
  editable,
}: {
  application: VenueApplication;
  venue: Venue | undefined;
  validation: ValidationState;
  snapshot: DemoSnapshot;
  presentation: AiPresentation | null;
  faultMode: FaultMode;
  onFaultModeChange: (mode: FaultMode) => void;
  onRun: (kind: AiPresentation['kind']) => void;
  onAdopt: (description: string) => void;
  busy: string | null;
  editable: boolean;
}) {
  const status = snapshot.case.status;
  const capacityOk = Boolean(venue && application.attendees <= venue.capacity);
  const running = busy?.startsWith('ai-') ?? false;

  // Which assistant is offered depends on where the case actually is, so the
  // console can never invite an action the state machine would refuse.
  const availableRun =
    status === 'draft'
      ? ({ kind: 'form', label: '运行表单整理' } as const)
      : status === 'submitted' || status === 'under_review'
        ? ({ kind: 'review', label: '生成审核摘要' } as const)
        : status === 'returned'
          ? ({ kind: 'return', label: '起草退回通知' } as const)
          : null;

  return (
    <aside className="bg-console flex flex-col gap-5 rounded-2xl p-5 text-slate-50 shadow-panel">
      <header className="border-b border-white/10 pb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Sparkles className="size-4 text-brand-300" aria-hidden="true" />
          AI 辅助台
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.7] text-slate-400">
          输出必须通过 Schema、规则 ID 与证据引用校验
        </p>
      </header>

      <div className="space-y-2">
        <Fact
          icon={UsersRound}
          label="预计人数"
          value={`${application.attendees} 人`}
          status={capacityOk ? '容量可用' : '需调整'}
          ok={capacityOk}
        />
        <Fact
          icon={CalendarDays}
          label="活动时间"
          value={formatDateTime(application.startTime)}
          status={validation ? '已校验' : '待校验'}
          ok={Boolean(validation?.passed)}
        />
        <Fact
          icon={Building2}
          label="候选场地"
          value={venue?.name ?? '未选择'}
          status={venue ? '已识别' : '无效'}
          ok={Boolean(venue)}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
        <label
          htmlFor="fault-mode"
          className="text-[12px] font-medium text-slate-300"
        >
          演示模型异常
        </label>
        <NativeSelect
          id="fault-mode"
          className="mt-2 w-full border-white/15 bg-ink-950 text-white"
          value={faultMode}
          onChange={(event) => onFaultModeChange(event.target.value as FaultMode)}
        >
          {faultOptions.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="mt-2.5 text-[11.5px] leading-[1.75] text-slate-400">
          真实模型模式下同样生效：先真实调用，再注入故障，拒绝理由和耗时都是真实测量值。
        </p>
      </div>

      <div className="min-h-[132px]">
        {running && (
          <div className="flex items-center gap-2 rounded-xl border border-brand-300/20 bg-brand-300/8 p-4 text-[12.5px] text-brand-100">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            正在生成并验证 AI 输出…
          </div>
        )}

        {!running && !presentation && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[13px] font-medium text-slate-200">等待运行</p>
            <p className="mt-1.5 text-[12px] leading-[1.75] text-slate-400">
              AI 可整理表述、生成审核摘要或起草退回通知；任何内容都不能自动改变正式状态。
            </p>
          </div>
        )}

        {!running && presentation && !presentation.result.ok && (
          <div className="rise-in rounded-xl border border-fail/30 bg-fail/12 p-4">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-rose-100">
              <AlertTriangle className="size-4" aria-hidden="true" />
              输出已拒绝
              <code className="rounded bg-rose-950/50 px-1.5 py-0.5 font-mono text-[11.5px]">
                {presentation.result.errorCode}
              </code>
            </p>
            <p className="mt-2 text-[12px] leading-[1.75] text-slate-300">
              {presentation.result.fallback}
            </p>
            <RunMeta result={presentation.result} />
          </div>
        )}

        {!running && presentation?.kind === 'form' && presentation.result.ok && (
          <div className="rise-in rounded-xl border border-brand-300/20 bg-brand-300/8 p-4">
            <p className="text-[12px] font-medium text-brand-200">表单整理建议</p>
            <p className="mt-2 text-[12.5px] leading-[1.75] text-slate-200">
              {presentation.result.output.suggestedDescription}
            </p>
            <p className="mt-2.5 text-[11.5px] leading-[1.75] text-slate-400">
              {presentation.result.output.explanation}
            </p>
            <KnowledgeTrail knowledge={presentation.result.knowledge} />
            <RunMeta result={presentation.result} />
            {presentation.result.output.suggestedDescription && editable && (
              <Button
                size="sm"
                className="mt-3 w-full bg-brand-600 hover:bg-brand-500"
                onClick={() =>
                  onAdopt(presentation.result.ok
                    ? (presentation.result.output.suggestedDescription ?? '')
                    : '')
                }
              >
                人工确认并采用
              </Button>
            )}
          </div>
        )}

        {!running && presentation?.kind === 'review' && presentation.result.ok && (
          <div className="rise-in rounded-xl border border-brand-300/20 bg-brand-300/8 p-4">
            <p className="text-[12px] font-medium text-brand-200">
              审核摘要 · 等待管理员判断
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.75] text-slate-200">
              {presentation.result.output.caseSummary}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {presentation.result.output.humanJudgementItems.map((item) => (
                <li
                  key={item}
                  className="text-[11.5px] leading-[1.7] text-slate-400"
                >
                  · {item}
                </li>
              ))}
            </ul>
            <KnowledgeTrail knowledge={presentation.result.knowledge} />
            <RunMeta result={presentation.result} />
          </div>
        )}

        {!running && presentation?.kind === 'return' && presentation.result.ok && (
          <div className="rise-in rounded-xl border border-brand-300/20 bg-brand-300/8 p-4">
            <p className="text-[12px] font-medium text-brand-200">
              退回通知草稿 · 等待管理员确认
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.75] text-slate-200">
              {presentation.result.output.message}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {presentation.result.output.requiredActions.map((item) => (
                <li
                  key={item}
                  className="text-[11.5px] leading-[1.7] text-slate-400"
                >
                  · {item}
                </li>
              ))}
            </ul>
            <KnowledgeTrail knowledge={presentation.result.knowledge} />
            <RunMeta result={presentation.result} />
          </div>
        )}
      </div>

      {availableRun ? (
        <Button
          variant="outline"
          className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          onClick={() => onRun(availableRun.kind)}
          disabled={busy !== null}
        >
          {availableRun.label}
        </Button>
      ) : (
        <p className="text-center text-[12px] text-slate-500">
          事务已归档，无需 AI 辅助
        </p>
      )}
    </aside>
  );
}
