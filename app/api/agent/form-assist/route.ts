import { z } from 'zod';

import { runFormAssist } from '@/lib/agent/provider';
import { faultModes } from '@/lib/agent/types';
import { contextJson, readContext } from '@/lib/server/session';

const requestSchema = z.object({
  application: z.object({
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
  }),
  faultMode: z.enum(faultModes).optional().default('none'),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'INVALID_REQUEST', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const context = readContext(request);
  return contextJson(
    context,
    await runFormAssist(context.caseId, parsed.data.application, parsed.data.faultMode),
  );
}

