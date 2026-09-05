export const faultModes = ['none', 'invalid_json', 'rule_999', 'timeout'] as const;
export type FaultMode = (typeof faultModes)[number];

export const agentTaskTypes = [
  'form_assist',
  'review_brief',
  'return_message_draft',
] as const;
export type AgentTaskType = (typeof agentTaskTypes)[number];

/** A knowledge document the task was allowed to read, echoed back for the UI. */
export type CitedKnowledge = { id: string; title: string; source: string };

/**
 * Rules that failed at the moment of the run. Returned so the interface can put
 * the deterministic verdict next to the model's prose: compliance is decided by
 * the rule engine, never by the assistant.
 */
export type RuleIssue = { ruleId: string; label: string; message: string };

export type AgentRunResult<T> =
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
