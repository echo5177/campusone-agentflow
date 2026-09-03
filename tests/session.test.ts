import { describe, expect, it } from 'vitest';

import { canTransition } from '@/lib/domain/state-machine';
import { caseStatuses } from '@/lib/domain/types';
import { actorCookie, readActor, switchableRoles } from '@/lib/server/session';

const withCookie = (cookie?: string) =>
  new Request('https://example.test/api/case', {
    headers: cookie ? { cookie } : {},
  });

describe('actor session', () => {
  it('defaults to the applicant when no cookie is present', () => {
    expect(readActor(withCookie())).toEqual({ role: 'student', actorId: 'student-lin' });
  });

  it.each(switchableRoles)('round-trips the %s role through its cookie', (role) => {
    const header = actorCookie(role);
    const value = header.split(';')[0];
    expect(readActor(withCookie(value)).role).toBe(role);
  });

  it('reads the actor cookie out of a larger cookie header', () => {
    const actor = readActor(withCookie('theme=dark; campusone_actor=admin; other=1'));
    expect(actor).toEqual({ role: 'admin', actorId: 'admin-zhou' });
  });

  it('falls back to the applicant for an unknown or forged role', () => {
    expect(readActor(withCookie('campusone_actor=system')).role).toBe('student');
    expect(readActor(withCookie('campusone_actor=superuser')).role).toBe('student');
  });

  it('keeps the cookie unreadable to page scripts', () => {
    expect(actorCookie('admin')).toContain('HttpOnly');
    expect(actorCookie('admin')).toContain('SameSite=Lax');
  });

  // The API used to take `role` from the request body, so an applicant could
  // approve their own case by sending role: "admin". The session is now the only
  // source, and every state change an applicant could ask for stays refused.
  it('never lets an applicant reach an administrator-only state', () => {
    const adminOnly: Array<[string, string]> = [
      ['submitted', 'under_review'],
      ['under_review', 'approved'],
      ['under_review', 'returned'],
      ['approved', 'completed'],
    ];
    for (const [from, to] of adminOnly) {
      expect(canTransition(from as never, to as never, 'student')).toBe(false);
      expect(canTransition(from as never, to as never, 'admin')).toBe(true);
    }
  });

  it('exposes only human roles as switchable', () => {
    expect([...switchableRoles]).toEqual(['student', 'admin']);
  });

  it('accepts every status the state machine knows about', () => {
    expect(caseStatuses).toContain('draft');
    expect(caseStatuses).toContain('completed');
  });
});

describe('transition idempotency key', () => {
  // Mirrors lib/server/store.ts. A retried click must produce the same key, and
  // no two steps of the lifecycle may collide onto one key.
  const key = (version: number, from: string, to: string) =>
    `CA-2026-0902-01-v${version}-${from}-to-${to}`;

  it('is stable for a repeated request', () => {
    expect(key(1, 'draft', 'submitted')).toBe(key(1, 'draft', 'submitted'));
  });

  it('is unique across a full return-and-resubmit lifecycle', () => {
    const lifecycle = [
      key(1, 'draft', 'submitted'),
      key(1, 'submitted', 'under_review'),
      key(1, 'under_review', 'returned'),
      key(1, 'returned', 'draft'),
      key(2, 'draft', 'submitted'),
      key(2, 'submitted', 'under_review'),
      key(2, 'under_review', 'approved'),
      key(2, 'approved', 'completed'),
    ];
    expect(new Set(lifecycle).size).toBe(lifecycle.length);
  });
});
