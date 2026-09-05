import { actorCookie, contextJson, readContext } from '@/lib/server/session';
import { resetDemo } from '@/lib/server/store';

export async function POST(request: Request) {
  const context = readContext(request);
  const snapshot = await resetDemo(context.caseId);
  // Reset is the "start the take again" button, so the acting identity goes back
  // to the applicant too. Clearing it only in the client would leave the server
  // still treating the caller as an administrator.
  return contextJson(context, snapshot, {
    headers: { 'Set-Cookie': actorCookie('student') },
  });
}
