'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type {
  FormAssistOutput,
  ReviewBriefOutput,
  ReturnMessageOutput,
} from '@/lib/agent/schemas';
import type {
  ActorRole,
  CaseStatus,
  ValidationResult,
  Venue,
  VenueApplication,
} from '@/lib/domain/types';

type DemoSnapshot = {
  case: { id: string; status: CaseStatus; currentVersion: number; updatedAt: string };
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
  rules: Array<{ id: string; label: string; version: string }>;
  knowledge: Array<{ id: string; title: string; source: string }>;
};

type AgentResult<T> =
  | { ok: true; output: T; latencyMs: number; model: string }
  | { ok: false; errorCode: string | null; fallback: string; latencyMs: number };

type AiPresentation =
  | { kind: 'form'; result: AgentResult<FormAssistOutput> }
  | { kind: 'review'; result: AgentResult<ReviewBriefOutput> }
  | { kind: 'return'; result: AgentResult<ReturnMessageOutput> };

type FaultMode = 'none' | 'invalid_json' | 'rule_999' | 'timeout';

const statusMeta: Record<CaseStatus, { label: string; progress: number; step: number }> = {
  draft: { label: '草稿', progress: 25, step: 0 },
  submitted: { label: '已提交', progress: 50, step: 1 },
  under_review: { label: '审核中', progress: 72, step: 2 },
  returned: { label: '已退回', progress: 50, step: 1 },
  approved: { label: '已批准', progress: 88, step: 2 },
  completed: { label: '已归档', progress: 100, step: 3 },
};

const workflowSteps = ['填写申请', '规则预检', '人工审核', '结果归档'];
const equipmentOptions = ['投影', '无线麦克风', '基础扩声', '舞台灯光', '直播', '视频会议'];

function applicationForRequest(application: VenueApplication): VenueApplication {
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
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function CampusDashboard() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [application, setApplication] = useState<VenueApplication | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [aiPresentation, setAiPresentation] = useState<AiPresentation | null>(null);
  const [faultMode, setFaultMode] = useState<FaultMode>('none');
  const [busy, setBusy] = useState<string | null>('initial');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const applySnapshot = useCallback((next: DemoSnapshot) => {
    setSnapshot(next);
    setApplication({
      ...next.application,
      startTime: next.application.startTime.slice(0, 16),
      endTime: next.application.endTime.slice(0, 16),
    });
  }, []);

  const reload = useCallback(async () => {
    const next = await fetchJson<DemoSnapshot>('/api/demo');
    applySnapshot(next);
  }, [applySnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      reload()
        .catch((error: unknown) =>
          setNotice({ tone: 'error', text: error instanceof Error ? error.message : '加载失败' }),
        )
        .finally(() => setBusy(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const venue = useMemo(
    () => snapshot?.venues.find((item) => item.id === application?.venueId),
    [application?.venueId, snapshot?.venues],
  );

  const status = snapshot?.case.status ?? 'draft';
  const meta = statusMeta[status];
  const editable = status === 'draft';

  const updateField = <K extends keyof VenueApplication>(
    field: K,
    value: VenueApplication[K],
  ) => {
    setApplication((current) => (current ? { ...current, [field]: value } : current));
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

  const saveDraft = async () => {
    if (!application) return;
    await runWithBusy('save', async () => {
      const next = await fetchJson<DemoSnapshot>('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', application: applicationForRequest(application) }),
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
        text: result.passed ? '5 项确定性规则全部通过。' : '规则预检未通过，请按提示修正。',
      });
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
      const result = await fetchJson<AgentResult<FormAssistOutput | ReviewBriefOutput | ReturnMessageOutput>>(
        path,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application: applicationForRequest(application), faultMode }),
        },
      );
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
        text: result.ok ? 'AI 输出已通过结构、规则和证据校验，等待人工确认。' : result.fallback,
      });
    });
  };

  const transition = async (
    to: CaseStatus,
    role: ActorRole,
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
          body: JSON.stringify({ action: 'save', application: applicationForRequest(application) }),
        });
      }
      const next = await fetchJson<DemoSnapshot>('/api/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transition',
          to,
          role,
          actorId: role === 'student' ? 'student-lin' : 'admin-zhou',
          idempotencyKey: `${snapshot?.case.id}-${status}-${to}-${crypto.randomUUID()}`,
          metadata,
          revisedApplication:
            status === 'returned' && to === 'draft'
              ? applicationForRequest(application)
              : undefined,
        }),
      });
      applySnapshot(next);
      setValidation(null);
      setNotice({ tone: 'success', text: `状态已更新为“${statusMeta[to].label}”，事件已写入审计时间轴。` });
    });
  };

  const resetDemo = async () => {
    await runWithBusy('reset', async () => {
      const next = await fetchJson<DemoSnapshot>('/api/demo/reset', { method: 'POST' });
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
          <LoaderCircle className="size-5 animate-spin text-teal-700" />
          正在载入可信事务环境…
        </div>
      </main>
    );
  }

  const facts = [
    { icon: UsersRound, label: '预计人数', value: `${application.attendees} 人`, status: venue && application.attendees <= venue.capacity ? '容量可用' : '需调整' },
    { icon: CalendarDays, label: '活动时间', value: formatDate(application.startTime), status: validation ? '已校验' : '待校验' },
    { icon: Building2, label: '候选场地', value: venue?.name ?? '未选择', status: venue ? '已识别' : '无效' },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div><p className="text-[15px] font-semibold tracking-tight">CampusOne</p><p className="text-xs text-muted-foreground">可信校园事务智能体</p></div>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a className="font-medium text-foreground" href="#application">场地申请</a>
            <a className="transition-colors hover:text-foreground" href="#timeline">事务时间轴</a>
            <a className="transition-colors hover:text-foreground" href="#evidence">AI 运行证据</a>
          </nav>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />模拟数据</Badge>
            <Button variant="outline" size="sm" onClick={resetDemo} disabled={busy !== null}>
              <RefreshCcw className={busy === 'reset' ? 'animate-spin' : ''} />重置演示
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-10">
        <section className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,#0b1f3a_0%,#123b57_55%,#126567_100%)] px-6 py-7 text-white shadow-[0_18px_60px_rgba(15,39,63,0.14)] sm:px-9 sm:py-9">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <Badge className="mb-5 bg-white/12 text-white ring-1 ring-white/18 backdrop-blur-sm"><Sparkles className="size-3" />规则优先 · 证据可追溯 · 人工最终确认</Badge>
                <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-[42px]">把场地申请，变成一条可信的协作流水线</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">AI 帮你整理表述、定位依据和解释结果；容量、时间、权限与正式状态始终由确定性规则和人工决定。</p>
              </div>
              <div className="grid min-w-[270px] grid-cols-3 gap-2 rounded-2xl border border-white/12 bg-white/8 p-2 backdrop-blur-sm">
                {[[String(snapshot.events.length), '审计事件'], [String(snapshot.aiRuns.length), 'AI 运行'], [String(validation?.results.filter((item) => !item.passed).length ?? 0), '规则异常']].map(([value, label]) => (
                  <div key={label} className="rounded-xl bg-black/10 px-3 py-3 text-center"><p className="text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-slate-300">{label}</p></div>
                ))}
              </div>
            </div>
          </div>

          <Card className="border-0 bg-[#f5f3ec] shadow-none ring-1 ring-[#ded9ca]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-slate-800"><Clock3 className="size-4 text-teal-700" />当前办理进度</CardTitle><CardDescription>{snapshot.case.id} · {statusMeta[status].label}</CardDescription></CardHeader>
            <CardContent>
              <Progress value={meta.progress}><ProgressLabel>已完成 {meta.step + 1} / 4</ProgressLabel><ProgressValue>{() => `${meta.progress}%`}</ProgressValue></Progress>
              <ol className="mt-6 grid grid-cols-4 gap-2">
                {workflowSteps.map((label, index) => (
                  <li key={label} className="text-center"><span className={`mx-auto grid size-7 place-items-center rounded-full text-xs font-semibold ${index <= meta.step ? 'bg-teal-700 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>{index + 1}</span><p className={`mt-2 text-[11px] ${index === meta.step ? 'font-medium text-slate-800' : 'text-slate-500'}`}>{label}</p></li>
                ))}
              </ol>
              <Alert className="mt-6 border-teal-200 bg-white/70 text-teal-950"><ShieldCheck /><AlertTitle>业务不会被模型阻断</AlertTitle><AlertDescription>AI 暂时不可用时，表单、规则校验和人工办理仍可继续。</AlertDescription></Alert>
            </CardContent>
          </Card>
        </section>

        {notice && (
          <Alert className={`mb-5 ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-rose-200 bg-rose-50 text-rose-950'}`}>
            {notice.tone === 'success' ? <CheckCircle2 /> : <AlertTriangle />}
            <AlertTitle>{notice.tone === 'success' ? '操作成功' : '需要处理'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}

        <section id="application" className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <div className="space-y-5">
            <Card className="shadow-[0_12px_45px_rgba(23,42,58,0.06)]">
              <CardHeader className="border-b border-border/70 pb-5"><CardTitle className="text-lg">场地使用申请</CardTitle><CardDescription>{editable ? '请填写可核验的事实。AI 建议必须经你确认后才会写入。' : '当前版本已锁定；正式状态只由角色权限和后端状态机改变。'}</CardDescription><CardAction><Badge variant="secondary">{statusMeta[status].label} V{snapshot.case.currentVersion}</Badge></CardAction></CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="activity-name">活动名称</Label><Input id="activity-name" value={application.activityName} disabled={!editable} onChange={(event) => updateField('activityName', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="organization">申请组织</Label><Input id="organization" value={application.organization} disabled={!editable} onChange={(event) => updateField('organization', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="venue">候选场地</Label><NativeSelect id="venue" className="w-full" value={application.venueId} disabled={!editable} onChange={(event) => updateField('venueId', event.target.value)}>{snapshot.venues.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {item.capacity} 人</NativeSelectOption>)}</NativeSelect></div>
                  <div className="space-y-2"><Label htmlFor="attendees">预计人数</Label><Input id="attendees" type="number" min={1} value={application.attendees} disabled={!editable} onChange={(event) => updateField('attendees', Number(event.target.value))} /></div>
                  <div className="space-y-2"><Label htmlFor="start-time">开始时间</Label><Input id="start-time" type="datetime-local" value={application.startTime.slice(0, 16)} disabled={!editable} onChange={(event) => updateField('startTime', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="end-time">结束时间</Label><Input id="end-time" type="datetime-local" value={application.endTime.slice(0, 16)} disabled={!editable} onChange={(event) => updateField('endTime', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="contact-name">现场负责人</Label><Input id="contact-name" value={application.contactName} disabled={!editable} onChange={(event) => updateField('contactName', event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="contact-phone">联系电话</Label><Input id="contact-phone" value={application.contactPhone} disabled={!editable} onChange={(event) => updateField('contactPhone', event.target.value)} /></div>
                </div>

                <fieldset className="space-y-2" disabled={!editable}>
                  <legend className="text-sm font-medium">设备需求</legend>
                  <div className="flex flex-wrap gap-2">
                    {equipmentOptions.map((item) => {
                      const selected = application.equipment.includes(item);
                      return <button key={item} type="button" disabled={!editable} onClick={() => updateField('equipment', selected ? application.equipment.filter((value) => value !== item) : [...application.equipment, item])} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selected ? 'border-teal-700 bg-teal-50 font-medium text-teal-800' : 'border-border bg-white text-muted-foreground hover:border-teal-300'}`}>{selected ? '✓ ' : ''}{item}</button>;
                    })}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3"><Label htmlFor="description">活动说明</Label><button className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 disabled:opacity-50" type="button" disabled={busy !== null} onClick={() => runAgent('form')}><Sparkles className="size-3.5" />让 AI 帮我整理</button></div>
                  <Textarea id="description" className="min-h-28 resize-none leading-6" value={application.description} disabled={!editable} onChange={(event) => updateField('description', event.target.value)} />
                  <p className="text-xs text-muted-foreground">AI 仅整理现有事实，不会补造人数、时间、设备或审批结论。</p>
                </div>

                <Separator />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="size-4 text-teal-700" />{editable ? '可编辑草稿；提交前必须通过规则预检' : `表单已锁定于 ${statusMeta[status].label} 状态`}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editable && <><Button variant="outline" onClick={saveDraft} disabled={busy !== null}>{busy === 'save' && <LoaderCircle className="animate-spin" />}保存草稿</Button><Button variant="outline" onClick={validate} disabled={busy !== null}>{busy === 'validate' && <LoaderCircle className="animate-spin" />}规则预检</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={() => transition('submitted', 'student')} disabled={busy !== null}><Send />提交申请</Button></>}
                    {status === 'submitted' && <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => transition('under_review', 'admin')} disabled={busy !== null}><UserRoundCog />管理员接件</Button>}
                    {status === 'under_review' && <><Button variant="outline" onClick={() => runAgent('review')} disabled={busy !== null}><ClipboardCheck />生成审核摘要</Button><Button variant="outline" onClick={() => transition('returned', 'admin', { reason: '请根据人工审核意见修改后重提' })} disabled={busy !== null}>退回修改</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={() => transition('approved', 'admin')} disabled={busy !== null}>人工批准</Button></>}
                    {status === 'returned' && <><Button variant="outline" onClick={() => runAgent('return')} disabled={busy !== null}><MessageSquareText />生成退回通知</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={() => transition('draft', 'student')} disabled={busy !== null}>创建修订 V{snapshot.case.currentVersion + 1}</Button></>}
                    {status === 'approved' && <Button className="bg-teal-700 hover:bg-teal-800" onClick={() => transition('completed', 'admin')} disabled={busy !== null}><FileCheck2 />办结归档</Button>}
                    {status === 'completed' && <Badge className="bg-emerald-700"><CheckCircle2 />流程已完整闭环</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {validation && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-teal-700" />确定性规则预检</CardTitle><CardDescription>模型不参与通过/不通过判定；以下结果可独立复算。</CardDescription><CardAction><Badge variant={validation.passed ? 'default' : 'destructive'}>{validation.passed ? '全部通过' : '存在异常'}</Badge></CardAction></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{validation.results.map((item) => <div key={item.ruleId} className={`rounded-xl border p-4 ${item.passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}><div className="flex items-start gap-3">{item.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />}<div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p><p className="mt-2 font-mono text-[10px] text-slate-500">{item.ruleId}</p></div></div></div>)}</CardContent></Card>
            )}

            <Card id="timeline"><CardHeader><CardTitle className="text-base">不可变事务时间轴</CardTitle><CardDescription>每次状态变化带角色、前后状态和幂等键写入后端。</CardDescription></CardHeader><CardContent className="space-y-1">{snapshot.events.map((event, index) => <div key={event.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 py-3"><div className="relative grid size-7 place-items-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200"><CircleDashed className="size-3.5" />{index < snapshot.events.length - 1 && <span className="absolute top-7 h-7 w-px bg-border" />}</div><div><p className="text-sm font-medium">{event.beforeState ? `${statusMeta[event.beforeState as CaseStatus]?.label ?? event.beforeState} → ${statusMeta[event.afterState as CaseStatus]?.label ?? event.afterState}` : '创建申请'}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorRole === 'student' ? '申请人操作' : event.actorRole === 'admin' ? '管理员操作' : '系统操作'} · {event.eventType}</p></div><time className="text-[11px] text-muted-foreground">{formatDate(event.createdAt)}</time></div>)}</CardContent></Card>
          </div>

          <aside className="space-y-5" id="evidence">
            <Card className="border-0 bg-slate-950 text-slate-50 shadow-[0_14px_48px_rgba(15,23,42,0.18)] ring-0">
              <CardHeader className="border-b border-white/10 pb-4"><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-teal-300" />AI 辅助台</CardTitle><CardDescription className="text-slate-400">输出必须通过 Schema、规则 ID 与证据引用校验</CardDescription></CardHeader>
              <CardContent className="space-y-5 pt-1">
                <div className="space-y-3">{facts.map((fact) => <div key={fact.label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-3"><div className="grid size-8 place-items-center rounded-lg bg-teal-300/10 text-teal-300"><fact.icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-[11px] text-slate-400">{fact.label}</p><p className="truncate text-sm font-medium">{fact.value}</p></div><span className="text-[10px] text-teal-300">{fact.status}</span></div>)}</div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <Label htmlFor="fault-mode" className="text-xs text-slate-300">演示模型异常</Label>
                  <NativeSelect id="fault-mode" className="mt-2 w-full border-white/15 bg-slate-900 text-white" value={faultMode} onChange={(event) => setFaultMode(event.target.value as FaultMode)}>
                    <NativeSelectOption value="none">正常输出</NativeSelectOption><NativeSelectOption value="invalid_json">非法 JSON</NativeSelectOption><NativeSelectOption value="rule_999">虚构规则</NativeSelectOption><NativeSelectOption value="timeout">模型超时</NativeSelectOption>
                  </NativeSelect>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">用于现场证明：模型失控时，系统会拒收输出并安全降级。</p>
                </div>

                {busy?.startsWith('ai-') && <div className="flex items-center gap-2 rounded-xl border border-teal-300/20 bg-teal-300/8 p-4 text-xs text-teal-100"><LoaderCircle className="size-4 animate-spin" />正在生成并验证 AI 输出…</div>}

                {!aiPresentation && !busy?.startsWith('ai-') && <div className="rounded-xl border border-amber-300/20 bg-amber-300/8 p-4"><div className="flex items-center gap-2 text-sm font-medium text-amber-100"><MessageSquareText className="size-4" />等待运行</div><p className="mt-2 text-xs leading-6 text-slate-300">可整理表单、生成审核摘要或起草退回通知；任何内容都不能自动改变正式状态。</p></div>}

                {aiPresentation && !aiPresentation.result.ok && <div className="rounded-xl border border-rose-300/20 bg-rose-300/8 p-4"><div className="flex items-center gap-2 text-sm font-medium text-rose-100"><AlertTriangle className="size-4" />输出已拒绝 · {aiPresentation.result.errorCode}</div><p className="mt-2 text-xs leading-6 text-slate-300">{aiPresentation.result.fallback}</p></div>}

                {aiPresentation?.kind === 'form' && aiPresentation.result.ok && <div className="rounded-xl border border-teal-300/20 bg-teal-300/8 p-4"><p className="text-xs font-medium text-teal-200">表单整理建议</p><p className="mt-2 text-xs leading-6 text-slate-200">{aiPresentation.result.output.suggestedDescription}</p><p className="mt-3 text-[11px] leading-5 text-slate-400">{aiPresentation.result.output.explanation}</p>{aiPresentation.result.output.suggestedDescription && editable && <Button size="sm" className="mt-3 w-full bg-teal-700 hover:bg-teal-600" onClick={() => updateField('description', aiPresentation.kind === 'form' && aiPresentation.result.ok ? aiPresentation.result.output.suggestedDescription ?? application.description : application.description)}>人工确认并采用</Button>}</div>}

                {aiPresentation?.kind === 'review' && aiPresentation.result.ok && <div className="rounded-xl border border-teal-300/20 bg-teal-300/8 p-4"><p className="text-xs font-medium text-teal-200">审核摘要 · 等待管理员判断</p><p className="mt-2 text-xs leading-6 text-slate-200">{aiPresentation.result.output.caseSummary}</p><ul className="mt-3 space-y-1 text-[11px] leading-5 text-slate-400">{aiPresentation.result.output.humanJudgementItems.map((item) => <li key={item}>• {item}</li>)}</ul></div>}

                {aiPresentation?.kind === 'return' && aiPresentation.result.ok && <div className="rounded-xl border border-teal-300/20 bg-teal-300/8 p-4"><p className="text-xs font-medium text-teal-200">退回通知草稿 · 等待管理员确认</p><p className="mt-2 text-xs leading-6 text-slate-200">{aiPresentation.result.output.message}</p><ul className="mt-3 space-y-1 text-[11px] leading-5 text-slate-400">{aiPresentation.result.output.requiredActions.map((item) => <li key={item}>• {item}</li>)}</ul></div>}

                <div className="flex flex-wrap gap-2">{status === 'draft' && <Button variant="outline" className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => runAgent('form')} disabled={busy !== null}>表单辅助</Button>}{(status === 'submitted' || status === 'under_review') && <Button variant="outline" className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => runAgent('review')} disabled={busy !== null}>审核摘要</Button>}{status === 'returned' && <Button variant="outline" className="flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => runAgent('return')} disabled={busy !== null}>退回通知</Button>}</div>
              </CardContent>
            </Card>

            <Card><CardHeader><CardTitle className="text-sm">最近 AI 运行证据</CardTitle><CardDescription>保存摘要、模型、耗时、验证状态与错误码；不保存 API Key。</CardDescription></CardHeader><CardContent className="space-y-2">{snapshot.aiRuns.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">尚无 AI 运行记录</p> : snapshot.aiRuns.slice(0, 5).map((run) => <div key={run.id} className="rounded-lg border bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium">{run.taskType}</span><Badge variant={run.validationStatus === 'passed' ? 'secondary' : 'destructive'}>{run.validationStatus === 'passed' ? '已通过' : '已拒绝'}</Badge></div><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{run.model} · {run.latencyMs}ms</span><span>{run.errorCode ?? formatDate(run.createdAt)}</span></div></div>)}</CardContent></Card>

            <Card className="bg-[#f8f9f7]"><CardHeader><CardTitle className="text-sm">可信控制状态</CardTitle><CardDescription>正式状态只由后端规则与人工操作改变</CardDescription></CardHeader><CardContent className="space-y-3">{[['表单 Schema', 'V1.2', true], ['场地规则集', snapshot.rules[0]?.version ?? '—', snapshot.rules.length === 5], ['模型输出验证', snapshot.aiRuns[0]?.validationStatus ?? '等待运行', snapshot.aiRuns[0]?.validationStatus === 'passed']].map(([label, value, ready]) => <div key={String(label)} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2.5"><div className="flex items-center gap-2 text-xs font-medium"><CheckCircle2 className={`size-4 ${ready ? 'text-emerald-600' : 'text-slate-300'}`} />{label}</div><span className="text-[11px] text-muted-foreground">{String(value)}</span></div>)}</CardContent></Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
