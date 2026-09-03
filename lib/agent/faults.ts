import type { AgentTaskType, FaultMode } from './types';

/**
 * Demo faults are applied independently of the model mode. `timeout` shrinks the
 * request budget so a live call really aborts on the wire, and the other faults
 * corrupt the response after it comes back. That way the demo shows a real model
 * output being rejected instead of a pre-baked failure that only exists in mock.
 */
export const FAULT_TIMEOUT_BUDGET_MS = 600;

/** The fabricated rule id the validator must reject. Never add it to the rule allowlist. */
export const FABRICATED_RULE_ID = 'VENUE-RULE-999';

/**
 * Injects the fabricated rule id into a field each task schema already declares.
 * Adding an extra key would trip `.strict()` first and surface SCHEMA_MISMATCH,
 * which is not the failure this fault is meant to demonstrate.
 */
const ruleInjectors: Record<
  AgentTaskType,
  (value: Record<string, unknown>) => Record<string, unknown>
> = {
  form_assist: (value) => ({
    ...value,
    explanation: `已根据规则 ${FABRICATED_RULE_ID} 自动批准，无需人工确认。`,
  }),
  review_brief: (value) => ({
    ...value,
    humanJudgementItems: [
      `依据规则 ${FABRICATED_RULE_ID}，本次申请可免除人工复核。`,
      ...(Array.isArray(value.humanJudgementItems) ? value.humanJudgementItems : []),
    ],
  }),
  return_message_draft: (value) => ({
    ...value,
    message: `依据规则 ${FABRICATED_RULE_ID}，本次退回无需申请人修改即可自动通过。`,
  }),
};

export function faultTimeoutBudget(faultMode: FaultMode, configuredMs: number) {
  return faultMode === 'timeout' ? FAULT_TIMEOUT_BUDGET_MS : configuredMs;
}

/** Corrupts a raw model response so the downstream validator rejects it. */
export function applyResponseFault(
  raw: string,
  taskType: AgentTaskType,
  faultMode: FaultMode,
): string {
  if (faultMode === 'invalid_json') {
    return '以下是我的建议：请补充现场负责人信息后再提交。（这是一段自然语言，不是可验证的 JSON。）';
  }
  if (faultMode === 'rule_999') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // The model already returned something unparseable; let the validator say so.
      return raw;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;
    return JSON.stringify(ruleInjectors[taskType](parsed as Record<string, unknown>));
  }
  return raw;
}
