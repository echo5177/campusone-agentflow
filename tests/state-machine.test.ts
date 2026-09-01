import { describe, expect, it } from 'vitest';

import { assertTransition, canTransition } from '@/lib/domain/state-machine';

describe('case state machine', () => {
  it('allows students to submit drafts', () => {
    expect(canTransition('draft', 'submitted', 'student')).toBe(true);
  });

  it('does not allow students to approve cases', () => {
    expect(canTransition('under_review', 'approved', 'student')).toBe(false);
  });

  it('requires returned cases to create a new draft before resubmission', () => {
    expect(canTransition('returned', 'draft', 'student')).toBe(true);
    expect(canTransition('returned', 'submitted', 'student')).toBe(false);
  });

  it('rejects invalid transitions with a stable error code', () => {
    expect(() => assertTransition('draft', 'approved', 'admin')).toThrow(
      'INVALID_TRANSITION',
    );
  });
});

