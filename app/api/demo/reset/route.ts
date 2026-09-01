import { resetDemo } from '@/lib/server/store';

export async function POST() {
  return Response.json(await resetDemo());
}

