import { contextJson, readContext } from '@/lib/server/session';
import { resetDemo } from '@/lib/server/store';

export async function POST(request: Request) {
  const context = readContext(request);
  return contextJson(context, await resetDemo(context.caseId));
}
