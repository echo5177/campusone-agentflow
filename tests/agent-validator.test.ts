import { describe, expect, it } from 'vitest';

import { formAssistSchema } from '@/lib/agent/schemas';
import {
  AgentValidationError,
  validateAgentOutput,
} from '@/lib/agent/validator';

const validRules = new Set(['VENUE-REQ-001']);
const validEvidence = new Set(['FORM:description', 'KB-VENUE-001']);

const validOutput = {
  taskType: 'form_assist',
  suggestedDescription: '面向全校新生开展项目展示、成员分享和招新答疑。',
  missingFields: [],
  explanation: '在不改变活动事实的前提下整理表述。',
  evidenceRefs: ['FORM:description'],
  requiresUserConfirmation: true,
};

describe('agent output validator', () => {
  it('accepts a schema-valid evidence-bound response', () => {
    expect(
      validateAgentOutput({
        raw: JSON.stringify(validOutput),
        schema: formAssistSchema,
        validRuleIds: validRules,
        validEvidenceRefs: validEvidence,
      }),
    ).toEqual(validOutput);
  });

  it('rejects non-JSON output', () => {
    expect(() =>
      validateAgentOutput({
        raw: '```json\n{}\n```',
        schema: formAssistSchema,
        validRuleIds: validRules,
        validEvidenceRefs: validEvidence,
      }),
    ).toThrow(AgentValidationError);
  });

  it('rejects extra fields', () => {
    expect(() =>
      validateAgentOutput({
        raw: JSON.stringify({ ...validOutput, approved: true }),
        schema: formAssistSchema,
        validRuleIds: validRules,
        validEvidenceRefs: validEvidence,
      }),
    ).toThrow('Unrecognized key');
  });

  it('rejects references to unknown evidence', () => {
    expect(() =>
      validateAgentOutput({
        raw: JSON.stringify({
          ...validOutput,
          evidenceRefs: ['SECRET:other_student'],
        }),
        schema: formAssistSchema,
        validRuleIds: validRules,
        validEvidenceRefs: validEvidence,
      }),
    ).toThrow('证据 SECRET:other_student 不存在');
  });
});
