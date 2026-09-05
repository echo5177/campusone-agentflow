'use client';

import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LoaderCircle,
  MessageSquareText,
  Send,
  Sparkles,
  UserRoundCog,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormSection, Panel, Pill } from './primitives';
import type {
  CaseStatus,
  DemoSnapshot,
  ValidationState,
  Venue,
  VenueApplication,
} from './types';
import { latestReturnReason, statusMeta, workflowSteps } from './types';

const equipmentOptions = [
  '投影',
  '无线麦克风',
  '基础扩声',
  '舞台灯光',
  '直播',
  '视频会议',
];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {workflowSteps.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold transition-colors ${
                current
                  ? 'bg-brand-700 text-white'
                  : done
                    ? 'bg-brand-100 text-brand-800'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`whitespace-nowrap text-[12.5px] ${
                current ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {index < workflowSteps.length - 1 && (
              <span
                className={`h-px flex-1 ${done ? 'bg-brand-300' : 'bg-border'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Verdict({
  result,
}: {
  result: {
    ruleId: string;
    label: string;
    passed: boolean;
    message: string;
    evidenceRefs: string[];
  };
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        result.passed
          ? 'border-pass-line bg-pass-soft/60'
          : 'border-fail-line bg-fail-soft/60'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {result.passed ? (
          <CheckCircle2
            className="mt-0.5 size-[18px] shrink-0 text-pass"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="mt-0.5 size-[18px] shrink-0 text-fail"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[13.5px] font-medium">{result.label}</p>
            <code className="rounded bg-card/80 px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground ring-1 ring-inset ring-border/70">
              {result.ruleId}
            </code>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.7] text-muted-foreground">
            {result.message}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {result.evidenceRefs.map((reference) => (
              <span
                key={reference}
                className="font-mono text-[11.5px] text-muted-foreground/80"
              >
                {reference}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WorkflowView({
  snapshot,
  application,
  validation,
  venue,
  editable,
  isStudent,
  isAdmin,
  busy,
  returnReason,
  onReturnReasonChange,
  onFieldChange,
  onSaveDraft,
  onValidate,
  onTransition,
  onRunAgent,
}: {
  snapshot: DemoSnapshot;
  application: VenueApplication;
  validation: ValidationState;
  venue: Venue | undefined;
  editable: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  busy: string | null;
  returnReason: string;
  onReturnReasonChange: (value: string) => void;
  onFieldChange: <K extends keyof VenueApplication>(
    field: K,
    value: VenueApplication[K],
  ) => void;
  onSaveDraft: () => void;
  onValidate: () => void;
  onTransition: (to: CaseStatus, metadata?: Record<string, unknown>) => void;
  onRunAgent: (kind: 'form' | 'review' | 'return') => void;
}) {
  const status = snapshot.case.status;
  const meta = statusMeta[status];
  const savedReturnReason = latestReturnReason(snapshot.events);
  const passedCount =
    validation?.results.filter((item) => item.passed).length ?? 0;

  // Mirrors the action buttons below, one branch per role, so the empty-state
  // hint cannot drift from what is actually rendered.
  const hasRoleAction =
    (isStudent && (status === 'draft' || status === 'returned')) ||
    (isAdmin &&
      (status === 'submitted' ||
        status === 'under_review' ||
        status === 'returned' ||
        status === 'approved'));

  return (
    <div className="space-y-5">
      <Panel className="px-5 py-4">
        <Stepper step={meta.step} />
      </Panel>

      {status === 'returned' && savedReturnReason && (
        <div className="rounded-2xl border border-warn-line bg-warn-soft px-5 py-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-warn">
            <MessageSquareText className="size-4 shrink-0" aria-hidden="true" />
            管理员退回意见
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.75] text-foreground">
            {savedReturnReason}
          </p>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            这条意见由管理员本人填写并写入退回事件，AI 起草的通知也只能引用它。
          </p>
        </div>
      )}

      <Panel
        title="场地使用申请"
        description={
          editable
            ? '请填写可核验的事实。AI 建议必须经你确认后才会写入。'
            : status === 'draft'
              ? '草稿只能由申请人本人编辑。'
              : '当前版本已锁定；正式状态只由角色权限和后端状态机改变。'
        }
        aside={<Pill tone={meta.tone}>{meta.label} · V{snapshot.case.currentVersion}</Pill>}
      >
        <div className="space-y-6">
          <FormSection title="活动信息">
            <Field label="活动名称" htmlFor="activity-name">
              <Input
                id="activity-name"
                value={application.activityName}
                disabled={!editable}
                onChange={(event) =>
                  onFieldChange('activityName', event.target.value)
                }
              />
            </Field>
            <Field label="申请组织" htmlFor="organization">
              <Input
                id="organization"
                value={application.organization}
                disabled={!editable}
                onChange={(event) =>
                  onFieldChange('organization', event.target.value)
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
                onChange={(event) => onFieldChange('venueId', event.target.value)}
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
                value={application.attendees}
                disabled={!editable}
                onChange={(event) =>
                  onFieldChange('attendees', Number(event.target.value))
                }
              />
            </Field>
            <Field
              label="开始时间"
              htmlFor="start-time"
              hint={
                venue ? `开放 ${venue.availableFrom}–${venue.availableTo}` : undefined
              }
            >
              <Input
                id="start-time"
                type="datetime-local"
                value={application.startTime.slice(0, 16)}
                disabled={!editable}
                onChange={(event) =>
                  onFieldChange('startTime', event.target.value)
                }
              />
            </Field>
            <Field label="结束时间" htmlFor="end-time">
              <Input
                id="end-time"
                type="datetime-local"
                value={application.endTime.slice(0, 16)}
                disabled={!editable}
                onChange={(event) => onFieldChange('endTime', event.target.value)}
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
                  onFieldChange('contactName', event.target.value)
                }
              />
            </Field>
            <Field label="联系电话" htmlFor="contact-phone">
              <Input
                id="contact-phone"
                value={application.contactPhone}
                disabled={!editable}
                onChange={(event) =>
                  onFieldChange('contactPhone', event.target.value)
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
                const offered = venue?.equipment.includes(item) ?? true;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    disabled={!editable}
                    onClick={() =>
                      onFieldChange(
                        'equipment',
                        selected
                          ? application.equipment.filter((value) => value !== item)
                          : [...application.equipment, item],
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? offered
                          ? 'border-brand-600 bg-brand-600 font-medium text-white'
                          : 'border-fail bg-fail-soft font-medium text-fail'
                        : offered
                          ? 'border-border bg-card text-muted-foreground hover:border-brand-300 hover:text-foreground'
                          : 'border-dashed border-border bg-muted/60 text-muted-foreground/70'
                    }`}
                  >
                    {selected && (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    )}
                    {item}
                  </button>
                );
              })}
            </div>
            {venue && (
              <p className="text-[11.5px] text-muted-foreground">
                {venue.name}可提供：{venue.equipment.join('、')}
              </p>
            )}
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="description" className="text-[13px] font-medium">
                活动说明
              </label>
              {editable && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => onRunAgent('form')}
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  让 AI 帮我整理
                </button>
              )}
            </div>
            <Textarea
              id="description"
              className="min-h-28 resize-none text-[13.5px] leading-[1.75]"
              value={application.description}
              disabled={!editable}
              onChange={(event) =>
                onFieldChange('description', event.target.value)
              }
            />
            <p className="text-[11.5px] text-muted-foreground">
              AI 仅整理现有事实，不会补造人数、时间、设备或审批结论。
            </p>
          </div>

          {status === 'under_review' && isAdmin && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
              <label
                htmlFor="return-reason"
                className="text-[13px] font-medium"
              >
                退回意见
                <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                  退回前必填，会写入退回事件并展示给申请人
                </span>
              </label>
              <Textarea
                id="return-reason"
                className="min-h-20 resize-none bg-card text-[13.5px] leading-[1.75]"
                placeholder="例如：预计人数接近场地容量上限，请补充现场秩序维护与疏散安排。"
                value={returnReason}
                onChange={(event) => onReturnReasonChange(event.target.value)}
              />
              {returnReason.trim().length === 0 && (
                <p className="text-[11.5px] text-muted-foreground">
                  未填写退回意见时“退回修改”不可用；批准和生成摘要不受影响。
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <FileCheck2 className="size-4 text-brand-600" aria-hidden="true" />
              {editable
                ? '可编辑草稿；提交前必须通过规则预检'
                : hasRoleAction
                  ? `以当前身份可在“${meta.label}”阶段执行下列操作`
                  : `当前身份在“${meta.label}”阶段没有可执行的操作，请在左侧切换身份。`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {editable && (
                <>
                  <Button
                    variant="outline"
                    onClick={onSaveDraft}
                    disabled={busy !== null}
                  >
                    {busy === 'save' && (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    )}
                    保存草稿
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onValidate}
                    disabled={busy !== null}
                  >
                    {busy === 'validate' && (
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                    )}
                    规则预检
                  </Button>
                  <Button
                    className="bg-brand-700 hover:bg-brand-800"
                    onClick={() => onTransition('submitted')}
                    disabled={busy !== null}
                  >
                    <Send aria-hidden="true" />
                    提交申请
                  </Button>
                </>
              )}
              {status === 'submitted' && isAdmin && (
                <Button
                  className="bg-brand-700 hover:bg-brand-800"
                  onClick={() => onTransition('under_review')}
                  disabled={busy !== null}
                >
                  <UserRoundCog aria-hidden="true" />
                  管理员接件
                </Button>
              )}
              {status === 'under_review' && isAdmin && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onRunAgent('review')}
                    disabled={busy !== null}
                  >
                    <ClipboardCheck aria-hidden="true" />
                    生成审核摘要
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      onTransition('returned', { reason: returnReason.trim() })
                    }
                    disabled={busy !== null || returnReason.trim().length === 0}
                  >
                    退回修改
                  </Button>
                  <Button
                    className="bg-brand-700 hover:bg-brand-800"
                    onClick={() => onTransition('approved')}
                    disabled={busy !== null}
                  >
                    人工批准
                  </Button>
                </>
              )}
              {status === 'returned' && isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => onRunAgent('return')}
                  disabled={busy !== null}
                >
                  <MessageSquareText aria-hidden="true" />
                  生成退回通知
                </Button>
              )}
              {status === 'returned' && isStudent && (
                <Button
                  className="bg-brand-700 hover:bg-brand-800"
                  onClick={() => onTransition('draft')}
                  disabled={busy !== null}
                >
                  创建修订 V{snapshot.case.currentVersion + 1}
                </Button>
              )}
              {status === 'approved' && isAdmin && (
                <Button
                  className="bg-brand-700 hover:bg-brand-800"
                  onClick={() => onTransition('completed')}
                  disabled={busy !== null}
                >
                  <FileCheck2 aria-hidden="true" />
                  办结归档
                </Button>
              )}
              {status === 'completed' && (
                <Pill tone="done">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  流程已完整闭环
                </Pill>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {validation && (
        <Panel
          id="rule-check"
          className="rise-in scroll-mt-6"
          title="确定性规则预检"
          description="模型不参与通过／不通过判定；以下结果可独立复算。"
          aside={
            <Pill tone={validation.passed ? 'done' : 'fail'}>
              {validation.passed
                ? `${validation.results.length} 项全部通过`
                : `${validation.results.length - passedCount} 项未通过`}
            </Pill>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {validation.results.map((result) => (
              <Verdict key={result.ruleId} result={result} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
