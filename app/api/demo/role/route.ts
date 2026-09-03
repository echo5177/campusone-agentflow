import { z } from 'zod';

import {
  actorCookie,
  readContext,
  switchableRoles,
} from '@/lib/server/session';

/**
 * Demo-only role switch. Production replaces this route with the campus SSO
 * callback; nothing else in the app changes, because every business route
 * already reads the actor from the session rather than from its request body.
 */
const requestSchema = z.object({ role: z.enum(switchableRoles) });

export async function GET(request: Request) {
  const context = readContext(request);
  return Response.json(
    { role: context.role, actorId: context.actorId, caseId: context.caseId },
    { headers: cookieHeaders(context.cookies) },
  );
}

function cookieHeaders(cookies: string[]) {
  const headers = new Headers();
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return headers;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: 'INVALID_ROLE', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const context = readContext(request);
  const headers = cookieHeaders([...context.cookies, actorCookie(parsed.data.role)]);
  return Response.json({ role: parsed.data.role, caseId: context.caseId }, { headers });
}
