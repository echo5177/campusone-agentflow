import { z } from 'zod';

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
    to: z.enum([
      'draft',
      'submitted',
      'under_review',
      'returned',
      'approved',
      'completed',
    ]),
    role: z.enum(['student', 'admin', 'system']),
    actorId: z.string(),
    idempotencyKey: z.string().min(8),
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
  try {
    return Response.json(
      parsed.data.action === 'save'
        ? await updateDraft(parsed.data.application)
        : await transitionCase(parsed.data),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' },
      { status: 409 },
    );
  }
}

