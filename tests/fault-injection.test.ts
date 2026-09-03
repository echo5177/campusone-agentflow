import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import {
  FABRICATED_RULE_ID,
  FAULT_TIMEOUT_BUDGET_MS,
  applyResponseFault,
  faultTimeoutBudget,
} from '@/lib/agent/faults';
import {
  formAssistSchema,
  returnMessageSchema,
  reviewBriefSchema,
} from '@/lib/agent/schemas';
import { agentTaskTypes } from '@/lib/agent/types';
import { AgentValidationError, validateAgentOutput } from '@/lib/agent/validator';

const validRuleIds = new Set([
  'VENUE-REQ-001',
  'VENUE-TIME-001',
  'VENUE-CAP-001',
  'VENUE-SLOT-001',
  'VENUE-EQP-001',
]);
const validEvidenceRefs = new Set(['FORM:description', 'KB-VENUE-001']);

const cleanOutputs = {
  form_assist: {
    schema: formAssistSchema,
    value: {
      taskType: 'form_assist',
      suggestedDescription: '面向全校新生开展项目展示、成员分享和招新答疑。',
      missingFields: [],
      explanation: '在不改变活动事实的前提下整理表述。',
      evidenceRefs: ['FORM:description'],
      requiresUserConfirmation: true,
    },
  },
  review_brief: {
    schema: reviewBriefSchema,
    value: {
      taskType: 'review_brief',
      caseSummary: '学生创新协会申请使用场地举办招新宣讲会。',
      passedRules: [{ ruleId: 'VENUE-REQ-001', evidenceRefs: ['FORM:description'] }],
      failedRules: [],
      missingInformation: [],
      humanJudgementItems: ['请人工确认现场联系人。'],
      requiresHumanReview: true,
    },
  },
  return_message_draft: {
    schema: returnMessageSchema,
    value: {
      taskType: 'return_message_draft',
      message: '你提交的申请暂需修改。',
      requiredActions: ['请补充现场负责人联系方式。'],
      evidenceRefs: ['KB-VENUE-001'],
      requiresHumanConfirmation: true,
    },
  },
} as const;

function validate(taskType: keyof typeof cleanOutputs, raw: string) {
  // The per-task schemas have unrelated output types, so the lookup widens to a
  // union that no single `ZodType<T>` accepts; the assertion only re-erases that.
  return validateAgentOutput({
    raw,
    schema: cleanOutputs[taskType].schema as ZodType<unknown>,
    validRuleIds,
    validEvidenceRefs,
  });
}

describe('demo fault injection', () => {
  it('covers every declared agent task', () => {
    expect(Object.keys(cleanOutputs).sort()).toEqual([...agentTaskTypes].sort());
  });

  it.each(agentTaskTypes)('leaves %s untouched when no fault is selected', (taskType) => {
    const raw = JSON.stringify(cleanOutputs[taskType].value);
    expect(applyResponseFault(raw, taskType, 'none')).toBe(raw);
    expect(() => validate(taskType, raw)).not.toThrow();
  });

  // Regression: the fabricated-rule fault previously added an `explanation` key
  // to strict schemas, so review_brief and return_message_draft reported
  // SCHEMA_MISMATCH instead of the RULE_NOT_FOUND the demo script narrates.
  it.each(agentTaskTypes)('rejects %s with RULE_NOT_FOUND under rule_999', (taskType) => {
    const faulted = applyResponseFault(
      JSON.stringify(cleanOutputs[taskType].value),
      taskType,
      'rule_999',
    );
    expect(faulted).toContain(FABRICATED_RULE_ID);
    try {
      validate(taskType, faulted);
      throw new Error('expected the fabricated rule to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentValidationError);
      expect((error as AgentValidationError).code).toBe('RULE_NOT_FOUND');
      expect((error as Error).message).toContain(FABRICATED_RULE_ID);
    }
  });

  it.each(agentTaskTypes)('rejects %s with INVALID_JSON under invalid_json', (taskType) => {
    const faulted = applyResponseFault(
      JSON.stringify(cleanOutputs[taskType].value),
      taskType,
      'invalid_json',
    );
    try {
      validate(taskType, faulted);
      throw new Error('expected non-JSON output to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentValidationError);
      expect((error as AgentValidationError).code).toBe('INVALID_JSON');
    }
  });

  it('passes unparseable model output through rather than masking it', () => {
    const raw = '模型直接返回了一段自然语言。';
    expect(applyResponseFault(raw, 'form_assist', 'rule_999')).toBe(raw);
  });

  it('shrinks the request budget only for the timeout fault', () => {
    expect(faultTimeoutBudget('timeout', 12000)).toBe(FAULT_TIMEOUT_BUDGET_MS);
    expect(faultTimeoutBudget('none', 12000)).toBe(12000);
    expect(faultTimeoutBudget('rule_999', 12000)).toBe(12000);
    expect(faultTimeoutBudget('invalid_json', 12000)).toBe(12000);
  });
});
