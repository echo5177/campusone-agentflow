import type {
  FormAssistOutput,
  ReturnMessageOutput,
  ReviewBriefOutput,
} from '@/lib/agent/schemas';
import type {
  ActorRole,
  CaseStatus,
  ValidationResult,
  Venue,
  VenueApplication,
} from '@/lib/domain/types';

export type DemoSnapshot = {
  demoPersistence?: 'local' | 'memory';
  case: {
    id: string;
    status: CaseStatus;
    currentVersion: number;
    updatedAt: string;
  };
  application: VenueApplication;
  versions: Array<{
    id: string;
    version: number;
    createdBy: string;
    createdAt: string;
    formData: VenueApplication;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorRole: ActorRole;
    actorId: string;
    beforeState: string | null;
    afterState: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  aiRuns: Array<{
    id: string;
    taskType: string;
    promptVersion: string;
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
  rules: Array<{ id: string; label: string; version: string; source: string }>;
  knowledge: Array<{
    id: string;
    title: string;
    source: string;
    content: string;
  }>;
};

export type CitedKnowledge = { id: string; title: string; source: string };

/** Rules that failed at the moment of an AI run, echoed back with the result. */
export type RuleIssue = { ruleId: string; label: string; message: string };

export type AgentResult<T> =
  | {
      ok: true;
      output: T;
      latencyMs: number;
      model: string;
      mode: 'mock' | 'live';
      knowledge: CitedKnowledge[];
      ruleIssues: RuleIssue[];
    }
  | {
      ok: false;
      errorCode: string | null;
      fallback: string;
      latencyMs: number;
      model: string;
      mode: 'mock' | 'live';
      knowledge: CitedKnowledge[];
      ruleIssues: RuleIssue[];
    };

export type AiPresentation =
  | { kind: 'form'; result: AgentResult<FormAssistOutput> }
  | { kind: 'review'; result: AgentResult<ReviewBriefOutput> }
  | { kind: 'return'; result: AgentResult<ReturnMessageOutput> };

export type FaultMode = 'none' | 'invalid_json' | 'rule_999' | 'timeout';

export type Notice = { tone: 'success' | 'error'; text: string } | null;

/** The four places a reviewer can be. Replaces the old anchor-link navigation. */
export const dashboardViews = [
  { id: 'workflow', label: '申请办理', group: '办理' },
  { id: 'case-file', label: '事务档案', group: '办理' },
  { id: 'reference', label: '规则与知识', group: '依据' },
  { id: 'evidence', label: 'AI 运行证据', group: '依据' },
] as const;

export type DashboardView = (typeof dashboardViews)[number]['id'];

export const statusMeta: Record<
  CaseStatus,
  { label: string; step: number; tone: 'neutral' | 'active' | 'warn' | 'done' }
> = {
  draft: { label: '草稿', step: 0, tone: 'neutral' },
  submitted: { label: '已提交', step: 1, tone: 'active' },
  under_review: { label: '审核中', step: 2, tone: 'active' },
  returned: { label: '已退回', step: 1, tone: 'warn' },
  approved: { label: '已批准', step: 2, tone: 'done' },
  completed: { label: '已归档', step: 3, tone: 'done' },
};

export const workflowSteps = ['填写申请', '规则预检', '人工审核', '结果归档'];

/** Fields shown when comparing two application versions, in form order. */
export const comparableFields: Array<{
  key: keyof VenueApplication;
  label: string;
}> = [
  { key: 'activityName', label: '活动名称' },
  { key: 'organization', label: '申请组织' },
  { key: 'venueId', label: '候选场地' },
  { key: 'attendees', label: '预计人数' },
  { key: 'startTime', label: '开始时间' },
  { key: 'endTime', label: '结束时间' },
  { key: 'contactName', label: '现场负责人' },
  { key: 'contactPhone', label: '联系电话' },
  { key: 'equipment', label: '设备需求' },
  { key: 'description', label: '活动说明' },
];

/** Reads the most recent administrator return reason out of the event log. */
export function latestReturnReason(
  events: Array<{ afterState: string; metadata: Record<string, unknown> }>,
): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.afterState !== 'returned') continue;
    const reason = event.metadata?.reason;
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
  }
  return null;
}

export const agentTaskLabels: Record<string, string> = {
  form_assist: '表单整理',
  review_brief: '审核摘要',
  return_message_draft: '退回通知',
};

export type ValidationState = ValidationResult | null;
export type { VenueApplication, Venue, CaseStatus, ValidationResult };
