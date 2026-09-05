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
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorRole: ActorRole;
    actorId: string;
    beforeState: string | null;
    afterState: string;
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

export type AgentResult<T> =
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

export const agentTaskLabels: Record<string, string> = {
  form_assist: '表单整理',
  review_brief: '审核摘要',
  return_message_draft: '退回通知',
};

export type ValidationState = ValidationResult | null;
export type { VenueApplication, Venue, CaseStatus, ValidationResult };
