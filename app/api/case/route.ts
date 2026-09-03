import { z } from 'zod';

import { caseStatuses } from '@/lib/domain/types';
import { contextJson, readContext } from '@/lib/server/session';
import { transitionCase, updateDraft } from '@/lib/server/store';

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

const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), application: applicationSchema }),
  z.object({
    action: z.literal('transition'),
    to: z.enum(caseStatuses),
    metadata: z.record(z.string(), z.unknown()).optional(),
    revisedApplication: applicationSchema.optional(),
  }),
]);

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'INVALID_REQUEST', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // The acting role and the case both come from the session, never from the
  // request body, so a caller can neither approve their own case by sending
  // `role: "admin"` nor reach another visitor's case.
  const context = readContext(request);
  try {
    return contextJson(
      context,
      parsed.data.action === 'save'
        ? await updateDraft(context.caseId, parsed.data.application, context)
        : await transitionCase({ ...parsed.data, ...context }),
    );
  } catch (error) {
    return contextJson(
      context,
      { error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' },
      { status: 409 },
    );
  }
}
