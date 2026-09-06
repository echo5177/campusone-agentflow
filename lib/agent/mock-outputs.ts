import type { KnowledgeSnippet } from './knowledge';
import type {
  FormAssistOutput,
  ReviewBriefOutput,
  ReturnMessageOutput,
} from './schemas';
import { missingRequiredFields } from '@/lib/domain/rules';
import type { VenueApplication, ValidationResult } from '@/lib/domain/types';

/** Shared by the server Mock provider and the browser-only Pages demo. */
export function buildFormMock(
  application: VenueApplication,
  knowledge: KnowledgeSnippet[],
): FormAssistOutput {
  const missingFields = missingRequiredFields(application).map(
    ({ field }) => field,
  );
  return {
    taskType: 'form_assist',
    suggestedDescription: application.description
      ? `${application.description.replace(/[。\s]+$/, '')}。活动将按照场地管理要求组织入场、设备使用与结束后的场地恢复。`
      : null,
    missingFields,
    explanation:
      '仅整理申请人已经提供的活动事实，并提示缺项；是否满足场地规则由规则引擎判定，本建议不作合规结论。',
    evidenceRefs: [
      'FORM:description',
      ...knowledge.map((document) => document.id),
    ],
    requiresUserConfirmation: true,
  } satisfies FormAssistOutput;
}

export function buildReviewMock(
  application: VenueApplication,
  validation: ValidationResult,
): ReviewBriefOutput {
  const passedRules = validation.results
    .filter((item) => item.passed)
    .map(({ ruleId, evidenceRefs }) => ({ ruleId, evidenceRefs }));
  const failedRules = validation.results
    .filter((item) => !item.passed)
    .map(({ ruleId, evidenceRefs }) => ({ ruleId, evidenceRefs }));
  return {
    taskType: 'review_brief',
    caseSummary: `${application.organization}申请使用场地举办“${application.activityName}”，预计 ${application.attendees} 人。`,
    passedRules,
    failedRules,
    missingInformation: failedRules.length
      ? ['请根据未通过规则补充或修正申请信息。']
      : [],
    humanJudgementItems:
      application.attendees >= 96
        ? ['预计人数达到场地容量的 80%，请人工复核秩序维护安排。']
        : ['请人工确认现场联系人和活动内容与实际一致。'],
    requiresHumanReview: true,
  } satisfies ReviewBriefOutput;
}

export function buildReturnMock(
  application: VenueApplication,
  validation: ValidationResult,
  reason: string | null,
  knowledge: KnowledgeSnippet[],
): ReturnMessageOutput {
  const failed = validation.results.filter((item) => !item.passed);
  return {
    taskType: 'return_message_draft',
    message: `你提交的“${application.activityName}”已被退回，需要修改后重新提交。原申请版本将保留。`,
    requiredActions: [
      ...(reason ? [`管理员退回意见：${reason}`] : []),
      ...failed.map((item) => `${item.ruleId}：${item.message}`),
      ...(reason || failed.length
        ? []
        : ['请补充管理员在人工审核中说明的材料。']),
    ],
    evidenceRefs: [
      ...new Set([
        ...failed.flatMap((item) => item.evidenceRefs),
        ...knowledge.map((document) => document.id),
      ]),
    ],
    requiresHumanConfirmation: true,
  } satisfies ReturnMessageOutput;
}
