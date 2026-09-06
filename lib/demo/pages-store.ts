import { z } from 'zod';
import type { DemoSnapshot, AgentResult } from '@/components/campus/types';
import { latestReturnReason } from '@/components/campus/types';
import { demoBookings, demoKnowledge, demoVenues } from './data';
import { initialApplication } from './initial-application';
import { ruleCatalog, validateVenueApplication } from '@/lib/domain/rules';
import { assertTransition, nextVersionFor } from '@/lib/domain/state-machine';
import { caseStatuses, type VenueApplication } from '@/lib/domain/types';
import {
  buildFormMock,
  buildReviewMock,
  buildReturnMock,
} from '@/lib/agent/mock-outputs';
import { selectKnowledgeIds } from '@/lib/agent/knowledge';
import {
  applyResponseFault,
  FAULT_TIMEOUT_BUDGET_MS,
} from '@/lib/agent/faults';
import { faultModes, type AgentTaskType } from '@/lib/agent/types';
import {
  formAssistSchema,
  reviewBriefSchema,
  returnMessageSchema,
} from '@/lib/agent/schemas';
import { assertReturnNoticeSemantics } from '@/lib/agent/semantics';
import { validRuleIds, validEvidenceRefs } from '@/lib/agent/evidence';
import {
  AgentValidationError,
  validateAgentOutput,
} from '@/lib/agent/validator';

export const STORAGE_KEY = 'campusone-pages-v1';
type DemoStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Role = 'student' | 'admin';
type StoredState = { schema: 1; role: Role; snapshot: DemoSnapshot };
const applicationSchema = z.object({
  activityName: z.string(),
  organization: z.string(),
  venueId: z.string(),
  attendees: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  equipment: z.array(z.string()),
});
const caseRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), application: applicationSchema }),
  z.object({
    action: z.literal('transition'),
    to: z.enum(caseStatuses),
    metadata: z.record(z.string(), z.unknown()).default({}),
    revisedApplication: applicationSchema.optional(),
  }),
]);
const agentRequest = z.object({
  application: applicationSchema,
  faultMode: z.enum(faultModes).default('none'),
});
const agentPaths: Record<string, AgentTaskType> = {
  '/api/agent/form-assist': 'form_assist',
  '/api/agent/review-brief': 'review_brief',
  '/api/agent/return-message': 'return_message_draft',
};
const timestamp = () => new Date().toISOString();

function freshState(): StoredState {
  const at = timestamp();
  const id = `VENUE-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    schema: 1,
    role: 'student',
    snapshot: {
      case: { id, status: 'draft', currentVersion: 1, updatedAt: at },
      application: structuredClone(initialApplication),
      versions: [
        {
          id: `${id}-V1`,
          version: 1,
          createdBy: 'student-lin',
          createdAt: at,
          formData: structuredClone(initialApplication),
        },
      ],
      events: [
        {
          id: crypto.randomUUID(),
          eventType: 'case_created',
          actorRole: 'student',
          actorId: 'student-lin',
          beforeState: null,
          afterState: 'draft',
          metadata: { version: 1 },
          createdAt: at,
        },
      ],
      aiRuns: [],
      venues: structuredClone(demoVenues),
      bookings: structuredClone(demoBookings),
      rules: ruleCatalog.map(({ id, label }) => ({
        id,
        label,
        version: '2026.09.2',
        source: '模拟场地管理规则',
      })),
      knowledge: structuredClone(demoKnowledge),
    },
  };
}

/** Local simulation only. Role checks illustrate the workflow; they are not authentication. */
export function createPagesClient(storage?: DemoStorage) {
  let state = freshState();
  let persistent = Boolean(storage);
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as StoredState;
      const s = saved.snapshot;
      if (
        saved.schema === 1 &&
        ['student', 'admin'].includes(saved.role) &&
        caseStatuses.includes(s.case.status) &&
        Number.isInteger(s.case.currentVersion) &&
        applicationSchema.safeParse(s.application).success &&
        s.versions.length > 0 &&
        s.versions.every(
          (v) => applicationSchema.safeParse(v.formData).success,
        ) &&
        Array.isArray(s.events) &&
        Array.isArray(s.aiRuns)
      ) {
        // Reference data follows the current build, while the visitor's workflow survives a reload.
        state = {
          ...saved,
          snapshot: {
            ...state.snapshot,
            case: s.case,
            application: s.application,
            versions: s.versions,
            events: s.events,
            aiRuns: s.aiRuns,
          },
        };
      }
    }
  } catch {
    /* An older or corrupt local snapshot starts a fresh demo. */
  }

  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      persistent = false;
    }
  };
  persist();
  const snapshot = () =>
    structuredClone({
      ...state.snapshot,
      demoPersistence: persistent ? ('local' as const) : ('memory' as const),
    });
  const validate = (application: VenueApplication) =>
    validateVenueApplication(
      application,
      demoVenues.find((venue) => venue.id === application.venueId),
      demoBookings,
    );

  async function dispatch(url: string, init?: RequestInit): Promise<unknown> {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const requestBody = init?.body;
    if (requestBody != null && typeof requestBody !== 'string')
      throw new Error('INVALID_REQUEST_BODY');
    const body: unknown = requestBody ? JSON.parse(requestBody) : {};
    if (url === '/api/demo' && method === 'GET') return snapshot();
    if (url === '/api/demo/role') {
      if (method === 'POST') {
        state.role = z
          .object({ role: z.enum(['student', 'admin']) })
          .parse(body).role;
        persist();
      } else if (method !== 'GET') throw new Error('METHOD_NOT_ALLOWED');
      return { role: state.role };
    }
    if (method !== 'POST') throw new Error('METHOD_NOT_ALLOWED');
    if (url === '/api/demo/reset') {
      state = freshState();
      persist();
      return snapshot();
    }
    if (url === '/api/validate') return validate(applicationSchema.parse(body));
    if (url === '/api/case') {
      const request = caseRequest.parse(body);
      const s = state.snapshot;
      const actorId = state.role === 'student' ? 'student-lin' : 'admin-demo';
      if (request.action === 'save') {
        if (s.case.status !== 'draft')
          throw new Error(`CASE_NOT_EDITABLE:${s.case.status}`);
        if (state.role !== 'student')
          throw new Error(`CASE_NOT_EDITABLE_BY:${state.role}`);
        s.application = structuredClone(request.application);
        const current = s.versions.find(
          (v) => v.version === s.case.currentVersion,
        )!;
        current.formData = structuredClone(request.application);
        current.createdBy = actorId;
      } else {
        const { to, metadata, revisedApplication } = request;
        const from = s.case.status;
        assertTransition(from, to, state.role);
        if (
          (to === 'submitted' || to === 'approved') &&
          !validate(s.application).passed
        ) {
          throw new Error('规则预检未通过，不能提交或批准。');
        }
        const version = nextVersionFor(from, to, s.case.currentVersion);
        if (version !== s.case.currentVersion && !revisedApplication)
          throw new Error('REVISION_REQUIRED');
        if (
          to === 'returned' &&
          (typeof metadata.reason !== 'string' || !metadata.reason.trim())
        )
          throw new Error('RETURN_REASON_REQUIRED');
        if (version !== s.case.currentVersion) {
          s.application = structuredClone(revisedApplication!);
          s.versions.unshift({
            id: `${s.case.id}-V${version}`,
            version,
            createdBy: actorId,
            createdAt: timestamp(),
            formData: structuredClone(revisedApplication!),
          });
        }
        s.events.push({
          id: crypto.randomUUID(),
          eventType: `${from}_to_${to}`,
          actorRole: state.role,
          actorId,
          beforeState: from,
          afterState: to,
          metadata: { ...metadata, version },
          createdAt: timestamp(),
        });
        s.case.status = to;
        s.case.currentVersion = version;
      }
      s.case.updatedAt = timestamp();
      persist();
      return snapshot();
    }
    const taskType = agentPaths[url];
    if (taskType) {
      const { application, faultMode } = agentRequest.parse(body);
      const validation = validate(application);
      const ids = selectKnowledgeIds({ taskType, application, validation });
      const knowledge = ids.flatMap((id) =>
        demoKnowledge.filter((doc) => doc.id === id),
      );
      const reason = latestReturnReason(state.snapshot.events);
      const currentStatus = state.snapshot.case.status;
      const activeState = state;
      const startedAt = Date.now();
      let output: unknown = null;
      let errorCode: string | null = null;
      try {
        if (faultMode === 'timeout') {
          await new Promise((resolve) =>
            setTimeout(resolve, FAULT_TIMEOUT_BUDGET_MS),
          );
          throw new Error('MODEL_TIMEOUT');
        }
        const candidate =
          taskType === 'form_assist'
            ? buildFormMock(application, knowledge)
            : taskType === 'review_brief'
              ? buildReviewMock(application, validation)
              : buildReturnMock(application, validation, reason, knowledge);
        const raw = applyResponseFault(
          JSON.stringify(candidate),
          taskType,
          faultMode,
        );
        const checked = (schema: z.ZodType) =>
          validateAgentOutput({ raw, schema, validRuleIds, validEvidenceRefs });
        if (taskType === 'form_assist') output = checked(formAssistSchema);
        else if (taskType === 'review_brief')
          output = checked(reviewBriefSchema);
        else {
          const notice = validateAgentOutput({
            raw,
            schema: returnMessageSchema,
            validRuleIds,
            validEvidenceRefs,
          });
          assertReturnNoticeSemantics(notice, { status: currentStatus });
          output = notice;
        }
      } catch (error) {
        errorCode =
          error instanceof AgentValidationError
            ? error.code
            : error instanceof Error
              ? error.message
              : 'MODEL_UNAVAILABLE';
      }
      const latencyMs = Date.now() - startedAt;
      // A reset during a timeout must not bring old runs into the fresh take.
      if (state === activeState) {
        state.snapshot.aiRuns.unshift({
          id: crypto.randomUUID(),
          taskType,
          promptVersion:
            {
              form_assist: 'form-assist-1.1',
              review_brief: 'review-brief-1.1',
              return_message_draft: 'return-message-1.2',
            }[taskType] + '#1',
          validationStatus: errorCode ? 'rejected' : 'passed',
          errorCode,
          latencyMs,
          model: 'mock-browser-1.0',
          createdAt: timestamp(),
        });
        persist();
      }
      const common = {
        latencyMs,
        model: 'mock-browser-1.0',
        mode: 'mock' as const,
        knowledge: knowledge.map(({ id, title, source }) => ({
          id,
          title,
          source,
        })),
        ruleIssues: validation.results
          .filter((item) => !item.passed)
          .map(({ ruleId, label, message }) => ({ ruleId, label, message })),
      };
      const result: AgentResult<unknown> = errorCode
        ? {
            ...common,
            ok: false,
            errorCode,
            fallback:
              taskType === 'return_message_draft' && reason
                ? `Mock 草稿未通过校验，已丢弃。管理员退回意见：“${reason}”。请据此修改后创建修订版本重新提交。`
                : 'Mock 输出未通过校验，已丢弃。请按规则提示继续填写或人工办理。',
          }
        : { ...common, ok: true, output };
      return structuredClone(result);
    }
    throw new Error(`UNKNOWN_DEMO_OPERATION:${url}`);
  }
  return {
    async request<T>(url: string, init?: RequestInit): Promise<T> {
      return (await dispatch(url, init)) as T;
    },
  };
}
