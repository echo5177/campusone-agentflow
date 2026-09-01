import { z } from 'zod';

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

export async function POST(request: Request) {
  const parsed = applicationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'INVALID_APPLICATION', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const venue = demoVenues.find((item) => item.id === parsed.data.venueId);
  return Response.json(
    validateVenueApplication(parsed.data, venue, demoBookings),
  );
}

