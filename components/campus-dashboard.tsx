'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  LoaderCircle,
  MessageSquareText,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  UsersRound,
  XCircle,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type {
  FormAssistOutput,
  ReviewBriefOutput,
  ReturnMessageOutput,
} from '@/lib/agent/schemas';
import { CAMPUS_TIME_ZONE } from '@/lib/domain/time';
import type {
  ActorRole,
  CaseStatus,
  ValidationResult,
  Venue,
  VenueApplication,
} from '@/lib/domain/types';
import type { SwitchableRole } from '@/lib/server/session';

type DemoSnapshot = {
  case: {
    id: string;
    status: CaseStatus;
    currentVersion: number;
    updatedAt: string;
  };
  application: VenueApplication;
  versions: Array<{ id: string; version: number; createdAt: string }>;
  events: Array<{
    id: string;
    eventType: string;
    actorRole: ActorRole;
    beforeState: string | null;
    afterState: string;
    createdAt: string;
  }>;
  aiRuns: Array<{
    id: string;
    taskType: string;
    validationStatus: string;
    errorCode: string | null;
    latencyMs: number;
    model: string;
    createdAt: string;
  }>;
  venues: Venue[];
  bookings: Array<{
    venueId: string;
    startTime: string;
    endTime: string;
    title: string;
  }>;
  rules: Array<{ id: string; label: string; version: string }>;
  knowledge: Array<{
    id: string;
    title: string;
    source: string;
    content: string;
  }>;
};

type CitedKnowledge = { id: string; title: string; source: string };

type AgentResult<T> =
  | {
      ok: true;
      output: T;
      latencyMs: number;
      model: string;
      mode: 'mock' | 'live';
      knowledge: CitedKnowledge[];
    }
  | {
      ok: false;
      errorCode: string | null;
      fallback: string;
      latencyMs: number;
      model: string;
      mode: 'mock' | 'live';
      knowledge: CitedKnowledge[];
    };

type AiPresentation =
  | { kind: 'form'; result: AgentResult<FormAssistOutput> }
  | { kind: 'review'; result: AgentResult<ReviewBriefOutput> }
  | { kind: 'return'; result: AgentResult<ReturnMessageOutput> };

type FaultMode = 'none' | 'invalid_json' | 'rule_999' | 'timeout';

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
};

type WebMcpContext = {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
};

declare global {
  interface Document {
    readonly modelContext?: WebMcpContext;
  }
}

const statusMeta: Record<
  CaseStatus,
  { label: string; progress: number; step: number }
> = {
  draft: { label: '草稿', progress: 25, step: 0 },
  submitted: { label: '已提交', progress: 50, step: 1 },
  under_review: { label: '审核中', progress: 72, step: 2 },
  returned: { label: '已退回', progress: 50, step: 1 },
  approved: { label: '已批准', progress: 88, step: 2 },
  completed: { label: '已归档', progress: 100, step: 3 },
};

const workflowSteps = ['填写申请', '规则预检', '人工审核', '结果归档'];
const roleLabels: Record<SwitchableRole, string> = {
  student: '申请人',
  admin: '管理员',
};
const switchableRoleOptions: SwitchableRole[] = ['student', 'admin'];

function KnowledgeTrail({ knowledge }: { knowledge: CitedKnowledge[] }) {
  if (knowledge.length === 0) return null;
  return (
    <div className="mt-3.5 border-t border-white/10 pt-3">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
        本次检索到的知识依据
      </p>
      <ul className="mt-2 space-y-1">
        {knowledge.map((document) => (
          <li
            key={document.id}
            className="text-[12px] leading-[1.7] text-slate-300"
          >
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
      <span
        className={result.mode === 'live' ? 'text-brand-300' : 'text-slate-400'}
      >
        {result.mode === 'live' ? 'LIVE' : 'MOCK'}
      </span>
      <span>{result.model}</span>
      <span data-numeric>{result.latencyMs}ms</span>
    </p>
  );
}

/** A titled band of form fields, so the form reads as groups instead of a wall. */
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
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
const equipmentOptions = [
  '投影',
  '无线麦克风',
  '基础扩声',
  '舞台灯光',
  '直播',
  '视频会议',
];

function applicationForRequest(
  application: VenueApplication,
): VenueApplication {
  const withOffset = (value: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+08:00` : value;
  return {
    ...application,
    startTime: withOffset(application.startTime),
    endTime: withOffset(application.endTime),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `HTTP_${response.status}`);
  return payload;
}

function formatDate(value: string) {
  // Pinned to the campus clock so a reviewer's machine timezone cannot shift a
  // displayed time away from the one the rules were evaluated against.
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CAMPUS_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function formatSlot(startTime: string, endTime: string) {
  const day = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CAMPUS_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startTime));
  const clock = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: CAMPUS_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  return `${day} ${clock(startTime)}–${clock(endTime)}`;
}

const dashboardSections = [
  { id: 'application', label: '场地申请' },
  { id: 'timeline', label: '事务时间轴' },
  { id: 'availability', label: '场地时段' },
  { id: 'knowledge', label: '知识库' },
  { id: 'evidence', label: 'AI 运行证据' },
] as const;

type DashboardSection = (typeof dashboardSections)[number]['id'];

export function CampusDashboard() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [application, setApplication] = useState<VenueApplication | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [aiPresentation, setAiPresentation] = useState<AiPresentation | null>(
    null,
  );
  const [faultMode, setFaultMode] = useState<FaultMode>('none');
  const [busy, setBusy] = useState<string | null>('initial');
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [activeSection, setActiveSection] =
    useState<DashboardSection>('application');
  const [actorRole, setActorRole] = useState<SwitchableRole>('student');
  const applicationRef = useRef(application);
  const dashboardReady = Boolean(snapshot && application);

  useEffect(() => {
    applicationRef.current = application;
  }, [application]);

  useEffect(() => {
    if (!dashboardReady) return;

    let frameId = 0;
    let hashFrameId = 0;
    const sectionIds = dashboardSections.map(({ id }) => id);
    const isDashboardSection = (value: string): value is DashboardSection =>
      sectionIds.includes(value as DashboardSection);

    const syncActiveSection = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const activationLine = window.scrollY + 97;
        const sections = sectionIds
          .map((id) => document.getElementById(id))
          .filter((element): element is HTMLElement => element !== null)
          .sort(
            (left, right) =>
              left.getBoundingClientRect().top -
              right.getBoundingClientRect().top,
          );

        let current = sections.reduce<DashboardSection>((selected, element) => {
          const elementTop =
            element.getBoundingClientRect().top + window.scrollY;
          return elementTop <= activationLine
            ? (element.id as DashboardSection)
            : selected;
        }, 'application');

        const atPageBottom =
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2;
        if (atPageBottom) {
          const lastVisibleSection = sections.findLast((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top < window.innerHeight && bounds.bottom > 65;
          });
          if (lastVisibleSection)
            current = lastVisibleSection.id as DashboardSection;
        }

        setActiveSection(current);
      });
    };

    const hashSection = window.location.hash.slice(1);
    if (isDashboardSection(hashSection)) {
      hashFrameId = window.requestAnimationFrame(() => {
        document.getElementById(hashSection)?.scrollIntoView();
        setActiveSection(hashSection);
      });
    }

    window.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('resize', syncActiveSection);
    window.addEventListener('hashchange', syncActiveSection);
    syncActiveSection();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(hashFrameId);
      window.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('resize', syncActiveSection);
      window.removeEventListener('hashchange', syncActiveSection);
    };
  }, [dashboardReady]);

  const applySnapshot = useCallback((next: DemoSnapshot) => {
    setSnapshot(next);
    setApplication({
      ...next.application,
      startTime: next.application.startTime.slice(0, 16),
      endTime: next.application.endTime.slice(0, 16),
    });
  }, []);

  const reload = useCallback(async () => {
    const [next, actor] = await Promise.all([
      fetchJson<DemoSnapshot>('/api/demo'),
      fetchJson<{ role: SwitchableRole }>('/api/demo/role'),
    ]);
    applySnapshot(next);
    setActorRole(actor.role);
  }, [applySnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reload()
        .catch((error: unknown) =>
          setNotice({
            tone: 'error',
            text: error instanceof Error ? error.message : '加载失败',
          }),
        )
        .finally(() => setBusy(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const options = { signal: lifecycle.signal };
    const tools: WebMcpTool[] = [
      {
        name: 'get_case_snapshot',
        title: '读取当前申请',
        description:
          '读取当前演示申请的正式状态、版本号、场地和最近事件，不改变任何数据。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        async execute() {
          const current = await fetchJson<DemoSnapshot>('/api/demo');
          return {
            caseId: current.case.id,
            status: current.case.status,
            version: current.case.currentVersion,
            activityName: current.application.activityName,
            venueId: current.application.venueId,
            eventCount: current.events.length,
          };
        },
      },
      {
        name: 'validate_current_application',
        title: '预检当前申请',
        description:
          '对页面中当前申请执行确定性规则预检，并把同一结果展示在页面中。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        async execute() {
          const current = applicationRef.current;
          if (!current) throw new Error('APPLICATION_NOT_READY');
          const checked = await fetchJson<ValidationResult>('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(applicationForRequest(current)),
          });
          setValidation(checked);
          return {
            passed: checked.passed,
            results: checked.results.map((item) => ({
              ruleId: item.ruleId,
              passed: item.passed,
              message: item.message,
            })),
          };
        },
      },
      {
        name: 'suggest_form_description',
        title: '生成表单整理建议',
        description:
          '为当前表单生成受约束的描述整理建议；只展示建议并记录运行，不会自动采纳或改变正式状态。',
        inputSchema: {
          type: 'object',
          properties: {
            faultMode: {
              type: 'string',
              enum: ['none', 'invalid_json', 'rule_999', 'timeout'],
              default: 'none',
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          const current = applicationRef.current;
          if (!current) throw new Error('APPLICATION_NOT_READY');
          const candidate = input as { faultMode?: FaultMode };
          const selectedFault = candidate.faultMode ?? 'none';
          if (
            !['none', 'invalid_json', 'rule_999', 'timeout'].includes(
              selectedFault,
            )
          ) {
            throw new Error('INVALID_FAULT_MODE');
          }
          const result = await fetchJson<AgentResult<FormAssistOutput>>(
            '/api/agent/form-assist',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                application: applicationForRequest(current),
                faultMode: selectedFault,
              }),
            },
          );
          setAiPresentation({ kind: 'form', result });
          await reload();
          return result.ok
            ? {
                ok: true,
                suggestion: result.output.suggestedDescription,
                evidenceRefs: result.output.evidenceRefs,
                requiresUserConfirmation:
                  result.output.requiresUserConfirmation,
              }
            : {
                ok: false,
                errorCode: result.errorCode,
                fallback: result.fallback,
              };
        },
      },
    ];

    void Promise.all(
      tools.map((tool) => Promise.resolve(context.registerTool(tool, options))),
    ).catch((error: unknown) => {
      console.error('WebMCP tool registration failed', error);
    });
    return () => lifecycle.abort();
  }, [reload]);

  const venue = useMemo(
    () => snapshot?.venues.find((item) => item.id === application?.venueId),
    [application?.venueId, snapshot?.venues],
  );

  const status = snapshot?.case.status ?? 'draft';
  const meta = statusMeta[status];
  const isStudent = actorRole === 'student';
  const isAdmin = actorRole === 'admin';
  // Mirrors the server-side state machine; the server is still the authority.
  const editable = status === 'draft' && isStudent;
  // Mirrors the buttons rendered below, one branch per role, so the empty-state
  // hint cannot drift away from what is actually on screen.
  const hasRoleAction =
    (isStudent && (status === 'draft' || status === 'returned')) ||
    (isAdmin &&
      (status === 'submitted' ||
        status === 'under_review' ||
        status === 'returned' ||
        status === 'approved'));

  const updateField = <K extends keyof VenueApplication>(
    field: K,
    value: VenueApplication[K],
  ) => {
    setApplication((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setValidation(null);
  };

  const runWithBusy = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '操作失败，请稍后重试。',
      });
    } finally {
      setBusy(null);
    }
  };

  const switchRole = async (role: SwitchableRole) => {
    await runWithBusy(`role-${role}`, async () => {
      const next = await fetchJson<{ role: SwitchableRole }>('/api/demo/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setActorRole(next.role);
      setAiPresentation(null);
      setNotice({
        tone: 'success',
        text: `当前操作身份已切换为“${roleLabels[next.role]}”。后端只承认这个身份，请求体里的角色字段会被忽略。`,
      });
    });
  };

  const saveDraft = async () => {
    if (!application) return;
    await runWithBusy('save', async () => {
      const next = await fetchJson<DemoSnapshot>('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          application: applicationForRequest(application),
        }),
      });
      applySnapshot(next);
      setNotice({ tone: 'success', text: '草稿已保存，正式状态未改变。' });
    });
  };

  const validate = async () => {
    if (!application) return null;
    let result: ValidationResult | null = null;
    await runWithBusy('validate', async () => {
      result = await fetchJson<ValidationResult>('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationForRequest(application)),
      });
      setValidation(result);
      setNotice({
        tone: result.passed ? 'success' : 'error',
        text: result.passed
          ? `${result.results.length} 项确定性规则全部通过。`
          : '规则预检未通过，请按提示修正。',
      });
      // The verdicts render below the form, so bring them into view rather than
      // leaving the reviewer looking at an unchanged screen after they click.
      requestAnimationFrame(() =>
        document
          .getElementById('rule-check')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      );
    });
    return result;
  };

  const runAgent = async (kind: AiPresentation['kind']) => {
    if (!application) return;
    await runWithBusy(`ai-${kind}`, async () => {
      const path =
        kind === 'form'
          ? '/api/agent/form-assist'
          : kind === 'review'
            ? '/api/agent/review-brief'
            : '/api/agent/return-message';
      const result = await fetchJson<
        AgentResult<FormAssistOutput | ReviewBriefOutput | ReturnMessageOutput>
      >(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: applicationForRequest(application),
          faultMode,
        }),
      });
      setAiPresentation(
        kind === 'form'
          ? { kind, result: result as AgentResult<FormAssistOutput> }
          : kind === 'review'
            ? { kind, result: result as AgentResult<ReviewBriefOutput> }
            : { kind, result: result as AgentResult<ReturnMessageOutput> },
      );
      await reload();
      setNotice({
        tone: result.ok ? 'success' : 'error',
        text: result.ok
          ? 'AI 输出已通过结构、规则和证据校验，等待人工确认。'
          : result.fallback,
      });
    });
  };

  const transition = async (
    to: CaseStatus,
    metadata: Record<string, unknown> = {},
  ) => {
    if (!application) return;
    await runWithBusy(`transition-${to}`, async () => {
      if (to === 'submitted') {
        const checked = await fetchJson<ValidationResult>('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applicationForRequest(application)),
        });
        setValidation(checked);
        if (!checked.passed) throw new Error('规则预检未通过，不能提交。');
        await fetchJson<DemoSnapshot>('/api/case', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            application: applicationForRequest(application),
          }),
        });
      }
      const next = await fetchJson<DemoSnapshot>('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transition',
          to,
          metadata,
          revisedApplication:
            status === 'returned' && to === 'draft'
              ? applicationForRequest(application)
              : undefined,
        }),
      });
      applySnapshot(next);
      setValidation(null);
      setNotice({
        tone: 'success',
        text: `状态已更新为“${statusMeta[to].label}”，事件已写入审计时间轴。`,
      });
    });
  };

  const resetDemo = async () => {
    await runWithBusy('reset', async () => {
      const next = await fetchJson<DemoSnapshot>('/api/demo/reset', {
        method: 'POST',
      });
      applySnapshot(next);
      setValidation(null);
      setAiPresentation(null);
      setNotice({ tone: 'success', text: '演示数据已恢复到初始草稿。' });
    });
  };

  if (!snapshot || !application) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-brand-600" />
          正在载入可信事务环境…
        </div>
      </main>
    );
  }

  const facts = [
    {
      icon: UsersRound,
      label: '预计人数',
      value: `${application.attendees} 人`,
      status:
        venue && application.attendees <= venue.capacity
          ? '容量可用'
          : '需调整',
      ok: Boolean(venue && application.attendees <= venue.capacity),
    },
    {
      icon: CalendarDays,
      label: '活动时间',
      value: formatDate(application.startTime),
      status: validation ? '已校验' : '待校验',
      ok: Boolean(validation?.passed),
    },
    {
      icon: Building2,
      label: '候选场地',
      value: venue?.name ?? '未选择',
      status: venue ? '已识别' : '无效',
      ok: Boolean(venue),
    },
  ];

  const passedCount =
    validation?.results.filter((item) => item.passed).length ?? 0;
  const heroStats = [
    { value: snapshot.events.length, label: '审计事件' },
    { value: snapshot.aiRuns.length, label: 'AI 运行' },
    {
      value: validation ? validation.results.length - passedCount : 0,
      label: '规则异常',
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1520px] items-center justify-between gap-6 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-ink-900 text-white shadow-sm ring-1 ring-ink-900/10">
              <ShieldCheck className="size-[22px]" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-semibold tracking-tight">
                CampusOne
              </p>
              <p className="text-[13px] text-muted-foreground">
                可信校园事务智能体
              </p>
            </div>
          </div>

          <nav
            aria-label="页面板块"
            className="hidden items-center gap-1 text-[13px] font-medium text-muted-foreground lg:flex"
          >
            {dashboardSections.map(({ id, label }) => (
              <a
                key={id}
                aria-current={activeSection === id ? 'location' : undefined}
                className={`rounded-full px-3.5 py-2 transition-colors ${
                  activeSection === id
                    ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                    : 'hover:bg-muted hover:text-foreground'
                }`}
                href={`#${id}`}
                onClick={() => setActiveSection(id)}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <fieldset
              className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-xs"
              aria-label="操作身份"
            >
              {switchableRoleOptions.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={actorRole === role}
                  disabled={busy !== null}
                  onClick={() => switchRole(role)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all disabled:opacity-50 ${
                    actorRole === role
                      ? 'bg-brand-700 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </fieldset>
            <Badge
              variant="outline"
              className="hidden gap-1.5 border-pass-line bg-pass-soft py-1.5 text-[12px] font-medium text-pass xl:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-pass" />
              模拟数据
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={resetDemo}
              disabled={busy !== null}
            >
              <RefreshCcw className={busy === 'reset' ? 'animate-spin' : ''} />
              重置演示
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1520px] px-5 py-7 sm:px-8 sm:py-9">
        {/* Hero + progress */}
        <section className="mb-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="bg-hero relative overflow-hidden rounded-3xl px-7 py-8 text-white shadow-panel sm:px-10 sm:py-10">
            <div className="bg-hero-grid pointer-events-none absolute inset-0 opacity-70" />
            <div className="relative flex flex-col justify-between gap-9 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-medium text-brand-100 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  规则优先 · 证据可追溯 · 人工最终确认
                </span>
                <h1 className="mt-5 text-[34px] font-semibold leading-[1.18] tracking-[-0.03em] sm:text-[44px]">
                  <span className="block">把场地申请</span>
                  <span className="block">变成一条可信的协作流水线</span>
                </h1>
                <p className="mt-5 max-w-xl text-[15px] leading-[1.85] text-slate-300">
                  AI
                  帮你整理表述、定位依据和解释结果；容量、时间、权限与正式状态，
                  始终由确定性规则和人工决定。
                </p>
              </div>

              {/* dt precedes dd as the spec requires; each tile is reversed
                  visually so the number still reads first. */}
              <dl className="grid min-w-[288px] shrink-0 grid-cols-3 gap-2.5">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col-reverse rounded-2xl bg-white/8 px-3 py-4 text-center ring-1 ring-inset ring-white/12 backdrop-blur-sm"
                  >
                    <dt className="mt-2 text-[12px] text-slate-400">
                      {stat.label}
                    </dt>
                    <dd
                      data-numeric
                      className="text-[26px] font-semibold leading-none tracking-tight"
                    >
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <Card className="gap-5 border-border/80 shadow-card">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Clock3 className="size-4 text-brand-600" aria-hidden="true" />
                当前办理进度
              </CardTitle>
              <CardDescription className="text-[13px]">
                <span className="font-mono text-[12px] tracking-tight">
                  {snapshot.case.id}
                </span>
                <span className="mx-1.5 text-border">|</span>
                当前身份 {roleLabels[actorRole]}
              </CardDescription>
              <CardAction>
                <Badge className="bg-brand-700 py-1 text-[12px]">
                  {statusMeta[status].label}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Progress value={meta.progress}>
                <ProgressLabel className="text-[13px]">
                  已完成 {meta.step + 1} / {workflowSteps.length}
                </ProgressLabel>
                <ProgressValue className="text-[13px]" data-numeric>
                  {() => `${meta.progress}%`}
                </ProgressValue>
              </Progress>

              <ol className="relative mt-6 grid grid-cols-4 gap-1">
                <span
                  aria-hidden="true"
                  className="absolute left-[12.5%] right-[12.5%] top-[15px] h-px bg-border"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-[12.5%] top-[15px] h-px bg-brand-600 transition-all duration-500"
                  style={{
                    width: `${(meta.step / (workflowSteps.length - 1)) * 75}%`,
                  }}
                />
                {workflowSteps.map((label, index) => (
                  <li key={label} className="relative text-center">
                    <span
                      className={`mx-auto grid size-[30px] place-items-center rounded-full text-[12px] font-semibold transition-colors ${
                        index < meta.step
                          ? 'bg-brand-600 text-white'
                          : index === meta.step
                            ? 'bg-brand-700 text-white ring-4 ring-brand-100'
                            : 'bg-card text-muted-foreground ring-1 ring-border'
                      }`}
                    >
                      {index < meta.step ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <p
                      className={`mt-2.5 text-[12.5px] ${
                        index === meta.step
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </p>
                  </li>
                ))}
              </ol>

              <Alert className="mt-6 border-brand-200 bg-brand-50 text-brand-900">
                <ShieldCheck className="text-brand-700" />
                <AlertTitle className="text-[13.5px]">
                  业务不会被模型阻断
                </AlertTitle>
                <AlertDescription className="text-[12.5px] leading-[1.7] text-brand-800/80">
                  AI 暂时不可用时，表单、规则校验和人工办理仍可继续。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </section>

        {notice && (
          <Alert
            key={notice.text}
            className={`rise-in mb-6 ${
              notice.tone === 'success'
                ? 'border-pass-line bg-pass-soft text-ink-900'
                : 'border-fail-line bg-fail-soft text-ink-900'
            }`}
          >
            {notice.tone === 'success' ? (
              <CheckCircle2 className="text-pass" />
            ) : (
              <AlertTriangle className="text-fail" />
            )}
            <AlertTitle className="text-[14px]">
              {notice.tone === 'success' ? '操作成功' : '需要处理'}
            </AlertTitle>
            <AlertDescription className="text-[13px] leading-[1.7] text-ink-900/75">
              {notice.text}
            </AlertDescription>
          </Alert>
        )}

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            {/* Application form */}
            <Card id="application" className="scroll-mt-24 shadow-card">
              <CardHeader className="border-b border-border/70 pb-5">
                <CardTitle className="text-[19px]">场地使用申请</CardTitle>
                <CardDescription className="text-[13px] leading-[1.7]">
                  {editable
                    ? '请填写可核验的事实。AI 建议必须经你确认后才会写入。'
                    : status === 'draft'
                      ? '草稿只能由申请人本人编辑。'
                      : `当前版本已锁定；正式状态只由角色权限和后端状态机改变。`}
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary" className="py-1 text-[12px]">
                    {statusMeta[status].label} · V{snapshot.case.currentVersion}
                  </Badge>
                </CardAction>
              </CardHeader>

              <CardContent className="space-y-7 pt-1">
                <FormSection title="活动信息">
                  <Field label="活动名称" htmlFor="activity-name">
                    <Input
                      id="activity-name"
                      value={application.activityName}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('activityName', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="申请组织" htmlFor="organization">
                    <Input
                      id="organization"
                      value={application.organization}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('organization', event.target.value)
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection title="场地与时间">
                  <Field label="候选场地" htmlFor="venue">
                    <NativeSelect
                      id="venue"
                      className="w-full"
                      value={application.venueId}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('venueId', event.target.value)
                      }
                    >
                      {snapshot.venues.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name} · {item.capacity} 人
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field
                    label="预计人数"
                    htmlFor="attendees"
                    hint={venue ? `场地容量 ${venue.capacity} 人` : undefined}
                  >
                    <Input
                      id="attendees"
                      type="number"
                      min={1}
                      data-numeric
                      value={application.attendees}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('attendees', Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label="开始时间"
                    htmlFor="start-time"
                    hint={
                      venue
                        ? `开放 ${venue.availableFrom}–${venue.availableTo}`
                        : undefined
                    }
                  >
                    <Input
                      id="start-time"
                      type="datetime-local"
                      value={application.startTime.slice(0, 16)}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('startTime', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="结束时间" htmlFor="end-time">
                    <Input
                      id="end-time"
                      type="datetime-local"
                      value={application.endTime.slice(0, 16)}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('endTime', event.target.value)
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection title="现场联系人">
                  <Field label="现场负责人" htmlFor="contact-name">
                    <Input
                      id="contact-name"
                      value={application.contactName}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('contactName', event.target.value)
                      }
                    />
                  </Field>
                  <Field label="联系电话" htmlFor="contact-phone">
                    <Input
                      id="contact-phone"
                      data-numeric
                      value={application.contactPhone}
                      disabled={!editable}
                      onChange={(event) =>
                        updateField('contactPhone', event.target.value)
                      }
                    />
                  </Field>
                </FormSection>

                <fieldset className="space-y-3" disabled={!editable}>
                  <legend className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                    设备需求
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {equipmentOptions.map((item) => {
                      const selected = application.equipment.includes(item);
                      const available = venue?.equipment.includes(item) ?? true;
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={selected}
                          disabled={!editable}
                          onClick={() =>
                            updateField(
                              'equipment',
                              selected
                                ? application.equipment.filter(
                                    (value) => value !== item,
                                  )
                                : [...application.equipment, item],
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition-all disabled:opacity-60 ${
                            selected
                              ? available
                                ? 'border-brand-600 bg-brand-600 font-medium text-white shadow-xs'
                                : 'border-fail-line bg-fail-soft font-medium text-fail'
                              : 'border-border bg-card text-muted-foreground hover:border-brand-300 hover:text-foreground'
                          }`}
                        >
                          {selected ? (
                            available ? (
                              <CheckCircle2
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            )
                          ) : null}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  {venue && (
                    <p className="text-[12.5px] text-muted-foreground">
                      {venue.name}可提供：{venue.equipment.join('、')}
                    </p>
                  )}
                </fieldset>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="description"
                      className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground"
                    >
                      活动说明
                    </Label>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 disabled:opacity-50"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => runAgent('form')}
                    >
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      让 AI 帮我整理
                    </button>
                  </div>
                  <Textarea
                    id="description"
                    className="min-h-28 resize-none text-[14px] leading-[1.8]"
                    value={application.description}
                    disabled={!editable}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                  />
                  <p className="text-[12.5px] text-muted-foreground">
                    AI 仅整理现有事实，不会补造人数、时间、设备或审批结论。
                  </p>
                </div>

                <Separator />

                <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <FileCheck2
                      className="size-4 shrink-0 text-brand-600"
                      aria-hidden="true"
                    />
                    {editable
                      ? '可编辑草稿；提交前必须通过规则预检'
                      : `表单已锁定于「${statusMeta[status].label}」状态`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editable && (
                      <>
                        <Button
                          variant="outline"
                          onClick={saveDraft}
                          disabled={busy !== null}
                        >
                          {busy === 'save' && (
                            <LoaderCircle className="animate-spin" />
                          )}
                          保存草稿
                        </Button>
                        <Button
                          variant="outline"
                          onClick={validate}
                          disabled={busy !== null}
                        >
                          {busy === 'validate' && (
                            <LoaderCircle className="animate-spin" />
                          )}
                          规则预检
                        </Button>
                        <Button
                          className="bg-brand-700 hover:bg-brand-800"
                          onClick={() => transition('submitted')}
                          disabled={busy !== null}
                        >
                          <Send />
                          提交申请
                        </Button>
                      </>
                    )}
                    {status === 'submitted' && isAdmin && (
                      <Button
                        className="bg-brand-700 hover:bg-brand-800"
                        onClick={() => transition('under_review')}
                        disabled={busy !== null}
                      >
                        <UserRoundCog />
                        管理员接件
                      </Button>
                    )}
                    {status === 'under_review' && isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => runAgent('review')}
                          disabled={busy !== null}
                        >
                          <ClipboardCheck />
                          生成审核摘要
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            transition('returned', {
                              reason: '请根据人工审核意见修改后重提',
                            })
                          }
                          disabled={busy !== null}
                        >
                          退回修改
                        </Button>
                        <Button
                          className="bg-brand-700 hover:bg-brand-800"
                          onClick={() => transition('approved')}
                          disabled={busy !== null}
                        >
                          人工批准
                        </Button>
                      </>
                    )}
                    {status === 'returned' && isAdmin && (
                      <Button
                        variant="outline"
                        onClick={() => runAgent('return')}
                        disabled={busy !== null}
                      >
                        <MessageSquareText />
                        生成退回通知
                      </Button>
                    )}
                    {status === 'returned' && isStudent && (
                      <Button
                        className="bg-brand-700 hover:bg-brand-800"
                        onClick={() => transition('draft')}
                        disabled={busy !== null}
                      >
                        创建修订 V{snapshot.case.currentVersion + 1}
                      </Button>
                    )}
                    {status === 'approved' && isAdmin && (
                      <Button
                        className="bg-brand-700 hover:bg-brand-800"
                        onClick={() => transition('completed')}
                        disabled={busy !== null}
                      >
                        <FileCheck2 />
                        办结归档
                      </Button>
                    )}
                    {status === 'completed' && (
                      <Badge className="gap-1.5 bg-pass py-1.5 text-[12.5px]">
                        <CheckCircle2 className="size-3.5" />
                        流程已完整闭环
                      </Badge>
                    )}
                    {!hasRoleAction && (
                      <span className="text-[12.5px] text-muted-foreground">
                        当前身份「{roleLabels[actorRole]}」在「
                        {statusMeta[status].label}
                        」阶段没有可执行的操作，请在右上角切换身份。
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deterministic rule verdicts */}
            {validation && (
              <Card
                id="rule-check"
                className="rise-in scroll-mt-24 shadow-card"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[16px]">
                    <ShieldCheck
                      className="size-4 text-brand-600"
                      aria-hidden="true"
                    />
                    确定性规则预检
                  </CardTitle>
                  <CardDescription className="text-[13px]">
                    模型不参与通过 / 不通过判定；以下结果可独立复算。
                  </CardDescription>
                  <CardAction>
                    <Badge
                      className={`py-1 text-[12px] ${
                        validation.passed ? 'bg-pass' : 'bg-fail'
                      }`}
                    >
                      {passedCount} / {validation.results.length} 通过
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {validation.results.map((item, index) => (
                    <div
                      key={item.ruleId}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className={`rise-in rounded-2xl border p-4 ${
                        item.passed
                          ? 'border-pass-line bg-pass-soft'
                          : 'border-fail-line bg-fail-soft'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                            item.passed
                              ? 'bg-pass text-white'
                              : 'bg-fail text-white'
                          }`}
                        >
                          {item.passed ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            <XCircle className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold">
                              {item.label}
                            </p>
                            <code className="rounded-md bg-card/80 px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground ring-1 ring-inset ring-border/70">
                              {item.ruleId}
                            </code>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-[1.7] text-ink-900/80">
                            {item.message}
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {item.evidenceRefs.map((reference) => (
                              <span
                                key={reference}
                                className="rounded font-mono text-[11.5px] text-muted-foreground"
                              >
                                {reference}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Audit timeline */}
            <Card id="timeline" className="scroll-mt-24 shadow-card">
              <CardHeader>
                <CardTitle className="text-[16px]">不可变事务时间轴</CardTitle>
                <CardDescription className="text-[13px]">
                  每次状态变化带角色、前后状态和幂等键写入后端。
                </CardDescription>
                <CardAction>
                  <Badge
                    variant="secondary"
                    className="py-1 text-[12px]"
                    data-numeric
                  >
                    {snapshot.events.length} 条
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-0">
                  {snapshot.events.map((event, index) => (
                    <li
                      key={event.id}
                      className="relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3.5 py-3"
                    >
                      <div className="relative grid size-8 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                        {index === snapshot.events.length - 1 ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <CircleDashed className="size-4" />
                        )}
                        {index < snapshot.events.length - 1 && (
                          <span className="absolute left-1/2 top-8 h-[26px] w-px -translate-x-1/2 bg-border" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium">
                          {event.beforeState
                            ? `${statusMeta[event.beforeState as CaseStatus]?.label ?? event.beforeState} → ${
                                statusMeta[event.afterState as CaseStatus]
                                  ?.label ?? event.afterState
                              }`
                            : '创建申请'}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11.5px] font-medium ${
                              event.actorRole === 'student'
                                ? 'bg-brand-50 text-brand-800'
                                : event.actorRole === 'admin'
                                  ? 'bg-secondary text-secondary-foreground'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {event.actorRole === 'student'
                              ? '申请人'
                              : event.actorRole === 'admin'
                                ? '管理员'
                                : '系统'}
                          </span>
                          <span className="font-mono text-[11.5px]">
                            {event.eventType}
                          </span>
                        </p>
                      </div>
                      <time className="pt-0.5 text-[12px] text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* AI console + reference panels */}
          <aside className="space-y-5">
            <Card className="bg-console gap-5 border-0 text-slate-50 shadow-panel ring-0">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <Sparkles
                    className="size-4 text-brand-300"
                    aria-hidden="true"
                  />
                  AI 辅助台
                </CardTitle>
                <CardDescription className="text-[12.5px] leading-[1.7] text-slate-400">
                  输出必须通过 Schema、规则 ID 与证据引用校验
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex items-center gap-3 rounded-xl bg-white/6 p-3 ring-1 ring-inset ring-white/10"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-400/12 text-brand-300">
                        <fact.icon className="size-[18px]" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-slate-400">
                          {fact.label}
                        </p>
                        <p
                          className="truncate text-[14px] font-medium"
                          data-numeric
                        >
                          {fact.value}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11.5px] ${
                          fact.ok ? 'text-brand-300' : 'text-amber-300'
                        }`}
                      >
                        {fact.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className={`rounded-xl p-3.5 ring-1 ring-inset transition-colors ${
                    faultMode === 'none'
                      ? 'bg-white/6 ring-white/10'
                      : 'bg-amber-400/10 ring-amber-300/35'
                  }`}
                >
                  <Label
                    htmlFor="fault-mode"
                    className="text-[12.5px] text-slate-300"
                  >
                    演示模型异常
                  </Label>
                  <NativeSelect
                    id="fault-mode"
                    className="mt-2 w-full border-white/15 bg-ink-950 text-[13px] text-white"
                    value={faultMode}
                    onChange={(event) =>
                      setFaultMode(event.target.value as FaultMode)
                    }
                  >
                    <NativeSelectOption value="none">
                      正常输出
                    </NativeSelectOption>
                    <NativeSelectOption value="invalid_json">
                      非法 JSON
                    </NativeSelectOption>
                    <NativeSelectOption value="rule_999">
                      虚构规则
                    </NativeSelectOption>
                    <NativeSelectOption value="timeout">
                      模型超时
                    </NativeSelectOption>
                  </NativeSelect>
                  <p className="mt-2.5 text-[11.5px] leading-[1.75] text-slate-400">
                    用于现场证明：模型失控时，系统会拒收输出并安全降级。真实模型模式下同样生效——先真实调用，再注入故障，拒绝理由和耗时都是真的。
                  </p>
                </div>

                {busy?.startsWith('ai-') && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-brand-400/10 p-4 text-[13px] text-brand-100 ring-1 ring-inset ring-brand-300/25">
                    <LoaderCircle className="size-4 animate-spin" />
                    正在生成并验证 AI 输出…
                  </div>
                )}

                {!aiPresentation && !busy?.startsWith('ai-') && (
                  <div className="rounded-xl bg-white/6 p-4 ring-1 ring-inset ring-white/10">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium text-slate-200">
                      <MessageSquareText
                        className="size-4"
                        aria-hidden="true"
                      />
                      等待运行
                    </div>
                    <p className="mt-2 text-[12.5px] leading-[1.8] text-slate-400">
                      可整理表单、生成审核摘要或起草退回通知；任何内容都不能自动改变正式状态。
                    </p>
                  </div>
                )}

                {aiPresentation && !aiPresentation.result.ok && (
                  <div className="rise-in rounded-xl bg-rose-400/10 p-4 ring-1 ring-inset ring-rose-300/30">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium text-rose-100">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      输出已拒绝
                      <code className="rounded bg-rose-950/50 px-1.5 py-0.5 font-mono text-[11.5px]">
                        {aiPresentation.result.errorCode}
                      </code>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-[1.8] text-slate-300">
                      {aiPresentation.result.fallback}
                    </p>
                    <RunMeta result={aiPresentation.result} />
                  </div>
                )}

                {aiPresentation?.kind === 'form' &&
                  aiPresentation.result.ok && (
                    <div className="rise-in rounded-xl bg-brand-400/10 p-4 ring-1 ring-inset ring-brand-300/25">
                      <p className="text-[12.5px] font-medium text-brand-200">
                        表单整理建议
                      </p>
                      <p className="mt-2 text-[13px] leading-[1.85] text-slate-100">
                        {aiPresentation.result.output.suggestedDescription}
                      </p>
                      <p className="mt-3 text-[12px] leading-[1.75] text-slate-400">
                        {aiPresentation.result.output.explanation}
                      </p>
                      <KnowledgeTrail
                        knowledge={aiPresentation.result.knowledge}
                      />
                      <RunMeta result={aiPresentation.result} />
                      {aiPresentation.result.output.suggestedDescription &&
                        editable && (
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-brand-600 text-[13px] hover:bg-brand-500"
                            onClick={() =>
                              updateField(
                                'description',
                                aiPresentation.kind === 'form' &&
                                  aiPresentation.result.ok
                                  ? (aiPresentation.result.output
                                      .suggestedDescription ??
                                      application.description)
                                  : application.description,
                              )
                            }
                          >
                            <CheckCircle2 />
                            人工确认并采用
                          </Button>
                        )}
                    </div>
                  )}

                {aiPresentation?.kind === 'review' &&
                  aiPresentation.result.ok && (
                    <div className="rise-in rounded-xl bg-brand-400/10 p-4 ring-1 ring-inset ring-brand-300/25">
                      <p className="text-[12.5px] font-medium text-brand-200">
                        审核摘要 · 等待管理员判断
                      </p>
                      <p className="mt-2 text-[13px] leading-[1.85] text-slate-100">
                        {aiPresentation.result.output.caseSummary}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {aiPresentation.result.output.humanJudgementItems.map(
                          (item) => (
                            <li
                              key={item}
                              className="flex gap-2 text-[12px] leading-[1.75] text-slate-400"
                            >
                              <span className="text-brand-300">·</span>
                              {item}
                            </li>
                          ),
                        )}
                      </ul>
                      <KnowledgeTrail
                        knowledge={aiPresentation.result.knowledge}
                      />
                      <RunMeta result={aiPresentation.result} />
                    </div>
                  )}

                {aiPresentation?.kind === 'return' &&
                  aiPresentation.result.ok && (
                    <div className="rise-in rounded-xl bg-brand-400/10 p-4 ring-1 ring-inset ring-brand-300/25">
                      <p className="text-[12.5px] font-medium text-brand-200">
                        退回通知草稿 · 等待管理员确认
                      </p>
                      <p className="mt-2 text-[13px] leading-[1.85] text-slate-100">
                        {aiPresentation.result.output.message}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {aiPresentation.result.output.requiredActions.map(
                          (item) => (
                            <li
                              key={item}
                              className="flex gap-2 text-[12px] leading-[1.75] text-slate-400"
                            >
                              <span className="text-brand-300">·</span>
                              {item}
                            </li>
                          ),
                        )}
                      </ul>
                      <KnowledgeTrail
                        knowledge={aiPresentation.result.knowledge}
                      />
                      <RunMeta result={aiPresentation.result} />
                    </div>
                  )}

                <div className="flex flex-wrap gap-2">
                  {status === 'draft' && (
                    <Button
                      variant="outline"
                      className="flex-1 border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                      onClick={() => runAgent('form')}
                      disabled={busy !== null}
                    >
                      表单辅助
                    </Button>
                  )}
                  {(status === 'submitted' || status === 'under_review') && (
                    <Button
                      variant="outline"
                      className="flex-1 border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                      onClick={() => runAgent('review')}
                      disabled={busy !== null}
                    >
                      审核摘要
                    </Button>
                  )}
                  {status === 'returned' && (
                    <Button
                      variant="outline"
                      className="flex-1 border-white/15 bg-white/6 text-white hover:bg-white/12 hover:text-white"
                      onClick={() => runAgent('return')}
                      disabled={busy !== null}
                    >
                      退回通知
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card id="availability" className="scroll-mt-24 shadow-card">
              <CardHeader>
                <CardTitle className="text-[15px]">
                  开放时间与已占用时段
                </CardTitle>
                <CardDescription className="text-[12.5px] leading-[1.7]">
                  VENUE-HOUR-001 与 VENUE-SLOT-001
                  判定所依据的事实，全部为模拟数据。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {snapshot.venues.map((item) => {
                  const taken = snapshot.bookings.filter(
                    (booking) => booking.venueId === item.id,
                  );
                  const selected = item.id === application.venueId;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        selected
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13.5px] font-semibold">
                          {item.name}
                        </p>
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                          {item.availableFrom}–{item.availableTo}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">
                        容量 {item.capacity} 人 · {item.equipment.join('、')}
                      </p>
                      {taken.length === 0 ? (
                        <p className="mt-2 text-[12.5px] text-muted-foreground">
                          暂无已占用时段
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {taken.map((booking) => (
                            <li
                              key={booking.title}
                              className="flex items-center gap-1.5 text-[12.5px] leading-[1.7] text-fail"
                            >
                              <span className="size-1.5 shrink-0 rounded-full bg-fail" />
                              {formatSlot(booking.startTime, booking.endTime)} ·{' '}
                              {booking.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card id="knowledge" className="scroll-mt-24 shadow-card">
              <CardHeader>
                <CardTitle className="text-[15px]">场地事务知识库</CardTitle>
                <CardDescription className="text-[12.5px] leading-[1.7]">
                  每条规则都绑定制度依据；AI 只能读取当前任务命中的条目。
                </CardDescription>
                <CardAction>
                  <Badge
                    variant="secondary"
                    className="py-1 text-[12px]"
                    data-numeric
                  >
                    {snapshot.knowledge.length} 篇
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {snapshot.knowledge.map((document) => {
                  const cited =
                    aiPresentation?.result.knowledge.some(
                      (item) => item.id === document.id,
                    ) ?? false;
                  return (
                    <div
                      key={document.id}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        cited
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px] font-semibold">
                          {document.title}
                        </p>
                        {cited && (
                          <Badge className="shrink-0 bg-brand-600 text-[11.5px]">
                            本次已引用
                          </Badge>
                        )}
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
              </CardContent>
            </Card>

            <Card id="evidence" className="scroll-mt-24 shadow-card">
              <CardHeader>
                <CardTitle className="text-[15px]">最近 AI 运行证据</CardTitle>
                <CardDescription className="text-[12.5px] leading-[1.7]">
                  保存摘要、模型、耗时、验证状态与错误码；不保存 API Key。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshot.aiRuns.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-5 text-center text-[12.5px] text-muted-foreground">
                    尚无 AI 运行记录
                  </p>
                ) : (
                  snapshot.aiRuns.slice(0, 5).map((run) => (
                    <div key={run.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[12.5px] font-medium">
                          {run.taskType}
                        </span>
                        <Badge
                          className={`shrink-0 py-0.5 text-[11.5px] ${
                            run.validationStatus === 'passed'
                              ? 'bg-pass'
                              : 'bg-fail'
                          }`}
                        >
                          {run.validationStatus === 'passed'
                            ? '已通过'
                            : '已拒绝'}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11.5px] text-muted-foreground">
                        <span data-numeric>
                          {run.model} · {run.latencyMs}ms
                        </span>
                        <span className="font-mono">
                          {run.errorCode ?? formatDate(run.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/40 shadow-card">
              <CardHeader>
                <CardTitle className="text-[15px]">可信控制状态</CardTitle>
                <CardDescription className="text-[12.5px]">
                  正式状态只由后端规则与人工操作改变
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(
                  [
                    ['表单 Schema', 'V1.2', true],
                    [
                      '场地规则集',
                      `${snapshot.rules.length} 条 · ${snapshot.rules[0]?.version ?? '—'}`,
                      snapshot.rules.length > 0,
                    ],
                    [
                      '模型输出验证',
                      snapshot.aiRuns[0]?.validationStatus ?? '等待运行',
                      snapshot.aiRuns[0]?.validationStatus === 'passed',
                    ],
                  ] as const
                ).map(([label, value, ready]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3"
                  >
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <CheckCircle2
                        className={`size-4 ${ready ? 'text-pass' : 'text-muted-foreground/40'}`}
                      />
                      {label}
                    </div>
                    <span className="text-[12px] text-muted-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
