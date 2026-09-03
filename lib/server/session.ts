/**
 * Demo-grade session. The point is that the business API never accepts a role
 * from the caller: `POST /api/case` reads whoever the server currently considers
 * the actor, so a request body can no longer claim `role: "admin"`.
 *
 * Switching roles is an explicit, separate action under `/api/demo/*` so the
 * seam is obvious: in production that endpoint is removed and this module reads
 * the role from the campus SSO session instead. Everything downstream — the
 * state machine, the actor id written to the audit trail — is unchanged.
 */
const ACTOR_COOKIE = 'campusone_actor';
const SESSION_COOKIE = 'campusone_session';

/** Roles a person can act as. `system` is reserved for server-initiated events. */
export const switchableRoles = ['student', 'admin'] as const;
export type SwitchableRole = (typeof switchableRoles)[number];

const DEFAULT_ROLE: SwitchableRole = 'student';

const actorIds: Record<SwitchableRole, string> = {
  student: 'student-lin',
  admin: 'admin-zhou',
};

function parseCookies(header: string | null): Map<string, string> {
  const entries = new Map<string, string>();
  if (!header) return entries;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    entries.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return entries;
}

function isSwitchableRole(value: string | undefined): value is SwitchableRole {
  return switchableRoles.includes(value as SwitchableRole);
}

export function readActor(request: Request): { role: SwitchableRole; actorId: string } {
  const raw = parseCookies(request.headers.get('cookie')).get(ACTOR_COOKIE);
  const role = isSwitchableRole(raw) ? raw : DEFAULT_ROLE;
  return { role, actorId: actorIds[role] };
}

export function actorCookie(role: SwitchableRole) {
  // HttpOnly so page scripts cannot forge it; Lax is enough for a same-origin demo.
  return `${ACTOR_COOKIE}=${role}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

/**
 * Each visitor gets their own case. The submitted 访问链接 will be opened by
 * several reviewers at once, and a single shared case would let one of them move
 * the workflow under everyone else's feet mid-review.
 */
export type DemoContext = {
  role: SwitchableRole;
  actorId: string;
  sessionId: string;
  caseId: string;
  /** Set-Cookie values this response must carry; empty for a returning visitor. */
  cookies: string[];
};

const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;

function newSessionId() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function caseIdForSession(sessionId: string) {
  return `CA-2026-0902-${sessionId.slice(0, 8).toUpperCase()}`;
}

export function readContext(request: Request): DemoContext {
  const cookies = parseCookies(request.headers.get('cookie'));
  const existing = cookies.get(SESSION_COOKIE);
  const sessionId = existing && SESSION_ID_PATTERN.test(existing) ? existing : newSessionId();
  const actor = readActor(request);
  return {
    ...actor,
    sessionId,
    caseId: caseIdForSession(sessionId),
    cookies: existing === sessionId ? [] : [sessionCookie(sessionId)],
  };
}

export function sessionCookie(sessionId: string) {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

/** Response.json plus whatever cookies the context needs to establish. */
export function contextJson(context: DemoContext, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  for (const cookie of context.cookies) headers.append('Set-Cookie', cookie);
  return Response.json(body, { ...init, headers });
}
