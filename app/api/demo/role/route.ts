import { z } from 'zod';

import { actorCookie, readActor, switchableRoles } from '@/lib/server/session';

/**
 * Demo-only role switch. Production replaces this route with the campus SSO
 * callback; nothing else in the app changes, because every business route
 * already reads the actor from the session rather than from its request body.
 */
const requestSchema = z.object({ role: z.enum(switchableRoles) });

export async function GET(request: Request) {
  return Response.json(readActor(request));
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'INVALID_ROLE', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  return Response.json(
    { role: parsed.data.role },
    { headers: { 'Set-Cookie': actorCookie(parsed.data.role) } },
  );
}
