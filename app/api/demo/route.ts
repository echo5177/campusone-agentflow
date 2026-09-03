import { contextJson, readContext } from '@/lib/server/session';
import { getDemoSnapshot } from '@/lib/server/store';

export async function GET(request: Request) {
  const context = readContext(request);
  return contextJson(context, await getDemoSnapshot(context.caseId));
}
