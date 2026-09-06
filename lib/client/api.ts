/** The server-backed application uses HTTP. The Pages build aliases this module. */
export const isStaticDemo = false;

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `HTTP_${response.status}`);
  return payload;
}
