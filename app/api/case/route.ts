import { z } from 'zod';

import { caseStatuses } from '@/lib/domain/types';
import { readActor } from '@/lib/server/session';
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
  // The acting role comes from the session, never from the request body, so a
  // caller cannot approve their own case by sending `role: "admin"`.
  const actor = readActor(request);
  try {
    return Response.json(
      parsed.data.action === 'save'
        ? await updateDraft(parsed.data.application, actor)
        : await transitionCase({ ...parsed.data, ...actor }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' },
      { status: 409 },
    );
  }
}
