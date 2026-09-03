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
const COOKIE_NAME = 'campusone_actor';

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
  const raw = parseCookies(request.headers.get('cookie')).get(COOKIE_NAME);
  const role = isSwitchableRole(raw) ? raw : DEFAULT_ROLE;
  return { role, actorId: actorIds[role] };
}

export function actorCookie(role: SwitchableRole) {
  // HttpOnly so page scripts cannot forge it; Lax is enough for a same-origin demo.
  return `${COOKIE_NAME}=${role}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}
