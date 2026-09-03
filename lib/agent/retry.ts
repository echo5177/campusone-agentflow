import type { FaultMode } from './types';

/**
 * One repair attempt. A live model occasionally returns a shape the strict schema
 * rejects; re-asking once with the validator's own complaint fed back fixes that
 * without turning a genuinely broken model into an expensive retry loop.
 */
export const MAX_ATTEMPTS = 2;

/** Only shape problems are worth re-asking for. A timeout or HTTP error is not. */
const REPAIRABLE_ERROR_CODES = new Set(['INVALID_JSON', 'SCHEMA_MISMATCH']);

export function shouldRepair({
  mode,
  faultMode,
  errorCode,
  attempt,
}: {
  mode: 'mock' | 'live';
  faultMode: FaultMode;
  errorCode: string | null;
  attempt: number;
}): boolean {
  if (attempt >= MAX_ATTEMPTS) return false;
  // Mock output is built locally and always well-formed, so a rejection there is
  // an injected fault, never a model slip.
  if (mode !== 'live') return false;
  // An injected fault must stay rejected — repairing it would erase the very
  // failure the demo is meant to show.
  if (faultMode !== 'none') return false;
  return errorCode !== null && REPAIRABLE_ERROR_CODES.has(errorCode);
}
