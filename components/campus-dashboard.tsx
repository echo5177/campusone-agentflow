'use client';

import { isStaticDemo } from '@/lib/client/api';


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileClock,
  LoaderCircle,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AiConsole } from '@/components/campus/ai-console';
import { CaseFileView } from '@/components/campus/case-file-view';
import { EvidenceView } from '@/components/campus/evidence-view';
import {
  Mono,
  Pill,
  applicationForRequest,
  fetchJson,
} from '@/components/campus/primitives';
import { ReferenceView } from '@/components/campus/reference-view';
import { WorkflowView } from '@/components/campus/workflow-view';
import type {
  AgentResult,
  AiPresentation,
  CaseStatus,
  DashboardView,
  DemoSnapshot,
  FaultMode,
  Notice,
  ValidationResult,
  VenueApplication,
} from '@/components/campus/types';
import { dashboardViews, statusMeta } from '@/components/campus/types';
import type { FormAssistOutput } from '@/lib/agent/schemas';
import type { SwitchableRole } from '@/lib/server/session';

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

const roleLabels: Record<SwitchableRole, string> = {
  student: '申请人',
  admin: '管理员',
};
const switchableRoleOptions: SwitchableRole[] = ['student', 'admin'];

const viewIcons: Record<DashboardView, typeof ClipboardList> = {
  workflow: ClipboardList,
  'case-file': FileClock,
  reference: ScrollText,
  evidence: Sparkles,
};

const isDashboardView = (value: string): value is DashboardView =>
  dashboardViews.some((view) => view.id === value);

export function CampusDashboard() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [application, setApplication] = useState<VenueApplication | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [aiPresentation, setAiPresentation] = useState<AiPresentation | null>(
    null,
  );
  const [faultMode, setFaultMode] = useState<FaultMode>('none');
  const [busy, setBusy] = useState<string | null>('initial');
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState<DashboardView>('workflow');
  const [actorRole, setActorRole] = useState<SwitchableRole>('student');
  const [returnReason, setReturnReason] = useState('');
  const applicationRef = useRef(application);

  useEffect(() => {
    applicationRef.current = application;
  }, [application]);

  // The view lives in the hash so a reviewer can link straight to a panel and a
  // reload keeps them where they were.
  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (isDashboardView(hash)) setView(hash);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const openView = useCallback((next: DashboardView) => {
    setView(next);
    // A notice belongs to the action that produced it; carrying it onto another
    // view would leave a validation result sitting above an unrelated panel.
    setNotice(null);
    window.history.replaceState(null, '', `#${next}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const applySnapshot = useCallback((next: DemoSnapshot) => {
    setSnapshot(next);
    setApplication({
      ...next.application,
      startTime: next.application.startTime.slice(0, 16),
      endTime: next.application.endTime.slice(0, 16),
    });
  }, []);

  /**
   * `keepForm` refreshes the snapshot without adopting the server's copy of the
   * application. An AI run reloads only to pick up the new run record, and
   * overwriting the form there threw away whatever the applicant had just typed
   * but not yet saved — type 800, ask for help, watch the field snap back to 80.
   */
  const reload = useCallback(
    async (options?: { keepForm?: boolean }) => {
      const [next, actor] = await Promise.all([
        fetchJson<DemoSnapshot>('/api/demo'),
        fetchJson<{ role: SwitchableRole }>('/api/demo/role'),
      ]);
      if (options?.keepForm) setSnapshot(next);
      else applySnapshot(next);
      setActorRole(actor.role);
    },
    [applySnapshot],
  );

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
          await reload({ keepForm: true });
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

  const updateField = <K extends keyof VenueApplication>(
    field: K,
    value: VenueApplication[K],
  ) => {
    setApplication((current) =>
      current ? { ...current, [field]: value } : current,
    );
    setValidation(null);
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
        text: isStaticDemo
          ? `当前演示身份已切换为“${roleLabels[next.role]}”。`
          : `当前操作身份已切换为“${roleLabels[next.role]}”。后端只承认这个身份，请求体里的角色字段会被忽略。`,
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
    if (!application) return;
    await runWithBusy('validate', async () => {
      const result = await fetchJson<ValidationResult>('/api/validate', {
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
      const result = await fetchJson<AgentResult<never>>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: applicationForRequest(application),
          faultMode,
        }),
      });
      setAiPresentation({ kind, result } as AiPresentation);
      await reload({ keepForm: true });
      // "已通过校验" refers to the model's output, not the application. Saying
      // only that above a failing rule check would read as an all-clear.
      const blocked = result.ok && result.ruleIssues.length > 0;
      setNotice({
        tone: result.ok && !blocked ? 'success' : 'error',
        text: !result.ok
          ? result.fallback
          : blocked
            ? `AI 输出已通过结构与证据校验；但规则预检有 ${result.ruleIssues.length} 项未通过，需先修正才能提交。`
            : 'AI 输出已通过结构、规则和证据校验，等待人工确认。',
      });
    });
  };

  const transition = async (
    to: CaseStatus,
    metadata: Record<string, unknown> = {},
  ) => {
    if (!application || !snapshot) return;
    const from = snapshot.case.status;
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
            from === 'returned' && to === 'draft'
              ? applicationForRequest(application)
              : undefined,
        }),
      });
      applySnapshot(next);
      setValidation(null);
      // The reason belongs to the return that was just recorded; keeping it in
      // the box would let the next review reuse wording nobody wrote for it.
      if (to === 'returned') setReturnReason('');
      setNotice({
        tone: 'success',
        text:
          to === 'returned'
            ? '已退回，退回意见已写入事件并对申请人可见。'
            : `状态已更新为“${statusMeta[to].label}”，事件已写入审计时间轴。`,
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
      // Reset is the "start recording again" button, so it also puts identity,
      // fault mode and the open view back where a take begins.
      setActorRole('student');
      setFaultMode('none');
      setReturnReason('');
      openView('workflow');
      setNotice({
        tone: 'success',
        text: '演示数据已恢复：草稿 V1、申请人身份、正常输出。',
      });
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

  const status = snapshot.case.status;
  const meta = statusMeta[status];
  const isStudent = actorRole === 'student';
  const isAdmin = actorRole === 'admin';
  const editable = status === 'draft' && isStudent;
  const groups = [...new Set(dashboardViews.map((item) => item.group))];

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {/* Ink sidebar. Carries identity, navigation and the demo controls, so the
          content area is only ever the work itself. */}
      <nav className="bg-console flex shrink-0 flex-col gap-6 px-4 py-5 text-slate-50 lg:sticky lg:top-0 lg:h-screen lg:w-[248px]">
        <div className="flex items-center gap-3 px-1.5">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/25"
            aria-hidden="true"
          >
            <ShieldCheck className="size-[21px]" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">
              CampusOne
            </p>
            <p className="text-[12px] text-slate-400">可信校园事务智能体</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {groups.map((group) => (
            <div key={group} className="space-y-1">
              <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {group}
              </p>
              {dashboardViews
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = viewIcons[item.id];
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => openView(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                        active
                          ? 'bg-white/12 font-medium text-white'
                          : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                      }`}
                    >
                      <Icon
                        className="size-[17px] shrink-0"
                        aria-hidden="true"
                      />
                      {item.label}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <p className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              操作身份
            </p>
            <fieldset
              className="mt-2 flex items-center gap-0.5 rounded-lg bg-white/6 p-1"
              aria-label="操作身份"
            >
              {switchableRoleOptions.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={actorRole === role}
                  disabled={busy !== null}
                  onClick={() => switchRole(role)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                    actorRole === role
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {roleLabels[role]}
                </button>
              ))}
            </fieldset>
            <p className="mt-2 px-1.5 text-[11.5px] leading-[1.7] text-slate-500">
              {isStaticDemo ? '本地角色切换用于体验办理流程。正式接入需使用服务端身份认证。' : '演示专用入口。业务接口只认服务端会话，请求体里的角色会被忽略。'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={resetDemo}
            disabled={busy !== null}
          >
            <RefreshCcw
              className={busy === 'reset' ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            重置演示
          </Button>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {/* Case identity bar. The one line a reviewer needs to know what they are
            looking at, present on every view. */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[62px] max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-2.5">
              <Mono className="bg-transparent px-0 text-[12.5px] text-foreground">
                {snapshot.case.id}
              </Mono>
              <Pill tone={meta.tone}>
                {meta.label} · V{snapshot.case.currentVersion}
              </Pill>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="neutral" className="hidden sm:inline-flex">
                <span className="size-1.5 rounded-full bg-pass" />
                {isStaticDemo ? 'Mock 演示' : '模拟数据'}
              </Pill>
              <Pill tone="neutral" className="hidden md:inline-flex">
                审计 <span data-numeric>{snapshot.events.length}</span>
              </Pill>
              <Pill tone="neutral" className="hidden md:inline-flex">
                AI <span data-numeric>{snapshot.aiRuns.length}</span>
              </Pill>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-5 py-6 sm:px-7">
          {isStaticDemo && (
            <p className="mb-5 text-[12px] leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">GitHub Pages · Mock 演示</strong>
              {' · 无需 API Key。'}
              {snapshot.demoPersistence === 'memory'
                ? '浏览器未允许本地存储，刷新后演示将重置。'
                : '数据仅保存在本浏览器，重置演示可清除。'}
              {'申请与审批均为流程模拟。'}
            </p>
          )}
          {notice && (
            <output
              className={`rise-in mb-5 w-full flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-[1.7] ${
                notice.tone === 'success'
                  ? 'border-pass-line bg-pass-soft text-pass'
                  : 'border-fail-line bg-fail-soft text-fail'
              }`}
            >
              {notice.tone === 'success' ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              )}
              {notice.text}
            </output>
          )}

          {view === 'workflow' && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <WorkflowView
                returnReason={returnReason}
                onReturnReasonChange={setReturnReason}
                snapshot={snapshot}
                application={application}
                validation={validation}
                venue={venue}
                editable={editable}
                isStudent={isStudent}
                isAdmin={isAdmin}
                busy={busy}
                onFieldChange={updateField}
                onSaveDraft={saveDraft}
                onValidate={validate}
                onTransition={transition}
                onRunAgent={runAgent}
              />
              {/* The grid column stretches and the wrapper sticks inside it, so
                  the console stays on screen while the longer form column
                  scrolls past. Sticking the panel itself would not work: as a
                  content-height grid item it has no room to travel within. */}
              <div>
                <div className="xl:sticky xl:top-[78px]">
                  <AiConsole
                    application={application}
                    venue={venue}
                    validation={validation}
                    snapshot={snapshot}
                    presentation={aiPresentation}
                    faultMode={faultMode}
                    onFaultModeChange={setFaultMode}
                    onRun={runAgent}
                    onAdopt={(description) =>
                      updateField('description', description)
                    }
                    busy={busy}
                    editable={editable}
                  />
                </div>
              </div>
            </div>
          )}

          {view === 'case-file' && <CaseFileView snapshot={snapshot} />}

          {view === 'reference' && (
            <ReferenceView
              snapshot={snapshot}
              application={application}
              presentation={aiPresentation}
            />
          )}

          {view === 'evidence' && <EvidenceView snapshot={snapshot} />}
        </main>
      </div>
    </div>
  );
}
