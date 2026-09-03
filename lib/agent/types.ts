export const faultModes = ['none', 'invalid_json', 'rule_999', 'timeout'] as const;
export type FaultMode = (typeof faultModes)[number];

export const agentTaskTypes = [
  'form_assist',
  'review_brief',
  'return_message_draft',
] as const;
export type AgentTaskType = (typeof agentTaskTypes)[number];

export type AgentRunResult<T> =
  | { ok: true; output: T; latencyMs: number; model: string; mode: 'mock' | 'live' }
  | {
      ok: false;
      errorCode: string | null;
      fallback: string;
      latencyMs: number;
      model: string;
      mode: 'mock' | 'live';
    };
