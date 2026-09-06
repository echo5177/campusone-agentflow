import { createPagesClient } from './pages-store';

export const isStaticDemo = true;
let client: ReturnType<typeof createPagesClient> | undefined;

/** No network fallback: every operation is handled in the current browser. */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  if (!client) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      /* Private/restricted browsing can disable storage. */
    }
    client = createPagesClient(storage);
  }
  return client.request<T>(url, init);
}
