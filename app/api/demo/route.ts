import { getDemoSnapshot } from '@/lib/server/store';

export async function GET() {
  return Response.json(await getDemoSnapshot());
}

