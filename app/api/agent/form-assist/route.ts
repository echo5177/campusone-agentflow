import { z } from 'zod';

import { runFormAssist } from '@/lib/agent/provider';
import { faultModes } from '@/lib/agent/types';
import { demoBookings, demoVenues } from '@/lib/demo/data';
import { validateVenueApplication } from '@/lib/domain/rules';
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
  // The assistant gets the deterministic verdict as verified context, the same
  // way review_brief and return_message do. Without it the model had nothing to
  // go on and would state compliance it could not know.
  const venue = demoVenues.find((item) => item.id === parsed.data.application.venueId);
  const validation = validateVenueApplication(
    parsed.data.application,
    venue,
    demoBookings,
  );
  return contextJson(
    context,
    await runFormAssist(
      context.caseId,
      parsed.data.application,
      validation,
      parsed.data.faultMode,
    ),
  );
}

