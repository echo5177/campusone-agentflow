import { z } from 'zod';

import { runReturnMessageDraft } from '@/lib/agent/provider';
import { faultModes } from '@/lib/agent/types';
import { contextJson, readContext } from '@/lib/server/session';
import { getReturnContext } from '@/lib/server/store';
import { demoBookings, demoVenues } from '@/lib/demo/data';
import { validateVenueApplication } from '@/lib/domain/rules';

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

const requestSchema = z.object({
  application: applicationSchema,
  faultMode: z.enum(faultModes).optional().default('none'),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_REQUEST', issues: parsed.error.issues }, { status: 400 });
  }
  const context = readContext(request);
  const venue = demoVenues.find((item) => item.id === parsed.data.application.venueId);
  const validation = validateVenueApplication(parsed.data.application, venue, demoBookings);
  // Read from the server, not the request: the notice has to be written against
  // the state the case is actually in and the reason a reviewer actually wrote.
  const returnContext = await getReturnContext(context.caseId);
  return contextJson(
    context,
    await runReturnMessageDraft(
      context.caseId,
      parsed.data.application,
      validation,
      returnContext,
      parsed.data.faultMode,
    ),
  );
}
