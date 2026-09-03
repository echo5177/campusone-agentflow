import type { ActorRole, CaseStatus } from './types';

type Transition = {
  from: CaseStatus;
  to: CaseStatus;
  roles: ActorRole[];
};

const transitions: Transition[] = [
  { from: 'draft', to: 'submitted', roles: ['student'] },
  { from: 'submitted', to: 'under_review', roles: ['admin'] },
  { from: 'under_review', to: 'returned', roles: ['admin'] },
  { from: 'returned', to: 'draft', roles: ['student'] },
  { from: 'under_review', to: 'approved', roles: ['admin'] },
  { from: 'approved', to: 'completed', roles: ['admin'] },
];

export function canTransition(
  from: CaseStatus,
  to: CaseStatus,
  role: ActorRole,
) {
  return transitions.some(
    (transition) =>
      transition.from === from &&
      transition.to === to &&
      transition.roles.includes(role),
  );
}

/**
 * A returned case is revised by creating a new version rather than editing the
 * one the reviewer saw, so the returned draft and the reviewer's copy both stay
 * on the record. Every other transition keeps the current version.
 */
export function nextVersionFor(
  from: CaseStatus,
  to: CaseStatus,
  currentVersion: number,
) {
  return from === 'returned' && to === 'draft' ? currentVersion + 1 : currentVersion;
}

export function assertTransition(
  from: CaseStatus,
  to: CaseStatus,
  role: ActorRole,
) {
  if (!canTransition(from, to, role)) {
    throw new Error(`INVALID_TRANSITION:${role}:${from}->${to}`);
  }
}

