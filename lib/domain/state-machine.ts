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

export function assertTransition(
  from: CaseStatus,
  to: CaseStatus,
  role: ActorRole,
) {
  if (!canTransition(from, to, role)) {
    throw new Error(`INVALID_TRANSITION:${role}:${from}->${to}`);
  }
}

