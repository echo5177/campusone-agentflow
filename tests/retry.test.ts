import { describe, expect, it } from 'vitest';
import { toJSONSchema } from 'zod';

import {
  formAssistSchema,
  returnMessageSchema,
  reviewBriefSchema,
} from '@/lib/agent/schemas';
import { MAX_ATTEMPTS, shouldRepair } from '@/lib/agent/retry';
import { faultModes } from '@/lib/agent/types';

const base = {
  mode: 'live',
  faultMode: 'none',
  errorCode: 'SCHEMA_MISMATCH',
  attempt: 1,
} as const;

describe('repair policy', () => {
  it('re-asks once when a live model returns the wrong shape', () => {
    expect(shouldRepair(base)).toBe(true);
    expect(shouldRepair({ ...base, errorCode: 'INVALID_JSON' })).toBe(true);
  });

  it('stops at the attempt ceiling', () => {
    expect(shouldRepair({ ...base, attempt: MAX_ATTEMPTS })).toBe(false);
  });

  // Repairing an injected fault would erase the failure the demo exists to show.
  it.each(faultModes.filter((mode) => mode !== 'none'))(
    'never repairs the %s fault',
    (faultMode) => {
      expect(shouldRepair({ ...base, faultMode })).toBe(false);
    },
  );

  it('does not repair in mock mode, where output is built locally', () => {
    expect(shouldRepair({ ...base, mode: 'mock' })).toBe(false);
  });

  it('does not re-ask after a transport failure', () => {
    expect(shouldRepair({ ...base, errorCode: 'MODEL_TIMEOUT' })).toBe(false);
    expect(shouldRepair({ ...base, errorCode: 'MODEL_HTTP_500' })).toBe(false);
    expect(shouldRepair({ ...base, errorCode: 'MODEL_KEY_MISSING' })).toBe(false);
    expect(shouldRepair({ ...base, errorCode: null })).toBe(false);
  });
});

describe('wire schema sent to the model', () => {
  // The contract the model is given is generated from the schema that judges its
  // answer, so a field cannot be described one way and validated another.
  it.each([
    ['form_assist', formAssistSchema],
    ['review_brief', reviewBriefSchema],
    ['return_message_draft', returnMessageSchema],
  ] as const)('describes %s as a closed object', (_name, schema) => {
    const wire = toJSONSchema(schema) as unknown as {
      type: string;
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(wire.type).toBe('object');
    expect(wire.additionalProperties).toBe(false);
    expect(wire.required.sort()).toEqual(Object.keys(wire.properties).sort());
  });

  it('pins the task discriminator and keeps a nullable field nullable', () => {
    const wire = toJSONSchema(formAssistSchema) as unknown as {
      properties: {
        taskType: { const: string };
        suggestedDescription: { anyOf: Array<{ type: string }> };
      };
    };
    expect(wire.properties.taskType.const).toBe('form_assist');
    expect(wire.properties.suggestedDescription.anyOf.map((one) => one.type)).toContain(
      'null',
    );
  });
});
