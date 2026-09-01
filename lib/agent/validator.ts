import type { ZodType } from 'zod';

export type AgentValidationErrorCode =
  | 'INVALID_JSON'
  | 'SCHEMA_MISMATCH'
  | 'RULE_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND';

export class AgentValidationError extends Error {
  constructor(
    public readonly code: AgentValidationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function validateAgentOutput<T>({
  raw,
  schema,
  validRuleIds,
  validEvidenceRefs,
}: {
  raw: string;
  schema: ZodType<T>;
  validRuleIds: Set<string>;
  validEvidenceRefs: Set<string>;
}): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AgentValidationError('INVALID_JSON', '模型未返回合法 JSON。');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AgentValidationError(
      'SCHEMA_MISMATCH',
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  }

  const serialized = JSON.stringify(result.data);
  const referencedRules = [...serialized.matchAll(/VENUE-[A-Z]+-\d{3}/g)].map(
    ([ruleId]) => ruleId,
  );
  const unknownRule = referencedRules.find((ruleId) => !validRuleIds.has(ruleId));
  if (unknownRule) {
    throw new AgentValidationError('RULE_NOT_FOUND', `规则 ${unknownRule} 不存在。`);
  }

  const collectEvidence = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(collectEvidence);
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) =>
        key === 'evidenceRefs' && Array.isArray(child)
          ? child.filter((item): item is string => typeof item === 'string')
          : collectEvidence(child),
      );
    }
    return [];
  };
  const unknownEvidence = collectEvidence(result.data).find(
    (reference) => !validEvidenceRefs.has(reference),
  );
  if (unknownEvidence) {
    throw new AgentValidationError(
      'EVIDENCE_NOT_FOUND',
      `证据 ${unknownEvidence} 不存在。`,
    );
  }

  return result.data;
}

