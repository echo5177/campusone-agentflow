import { z } from 'zod';

import { runReviewBrief } from '@/lib/agent/provider';
import { faultModes } from '@/lib/agent/types';
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
  const venue = demoVenues.find((item) => item.id === parsed.data.application.venueId);
  const validation = validateVenueApplication(parsed.data.application, venue, demoBookings);
  return Response.json(
    await runReviewBrief(parsed.data.application, validation, parsed.data.faultMode),
  );
}
