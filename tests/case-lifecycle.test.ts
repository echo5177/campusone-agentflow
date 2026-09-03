import { describe, expect, it } from 'vitest';

import { demoBookings, demoVenues } from '@/lib/demo/data';
import { missingRequiredFields, validateVenueApplication } from '@/lib/domain/rules';
import { canTransition, nextVersionFor } from '@/lib/domain/state-machine';
import { caseStatuses } from '@/lib/domain/types';
import type { CaseStatus, VenueApplication } from '@/lib/domain/types';

const application: VenueApplication = {
  activityName: '2026 秋季社团招新宣讲会',
  organization: '学生创新协会',
  venueId: 'activity-center',
  attendees: 80,
  startTime: '2026-09-08T19:00:00+08:00',
  endTime: '2026-09-08T21:00:00+08:00',
  description: '面向全校新生介绍协会方向与年度计划。',
  contactName: '林同学',
  contactPhone: '13800000000',
  equipment: ['投影', '无线麦克风', '基础扩声'],
};

// T05 — a missing contact must come back as a named gap, not a generic refusal.
describe('T05 missing required fields', () => {
  it('names nothing when the form is complete', () => {
    expect(missingRequiredFields(application)).toEqual([]);
  });

  it('names the missing contact fields', () => {
    const gaps = missingRequiredFields({
      ...application,
      contactName: '',
      contactPhone: '   ',
    });
    expect(gaps.map((gap) => gap.field)).toEqual(['contactName', 'contactPhone']);
    expect(gaps.map((gap) => gap.label)).toEqual(['现场负责人', '联系电话']);
  });

  it('puts those labels into the rule message a reviewer reads', () => {
    const { results } = validateVenueApplication(
      { ...application, contactPhone: '' },
      demoVenues[0],
      demoBookings,
    );
    const required = results.find((item) => item.ruleId === 'VENUE-REQ-001')!;
    expect(required.passed).toBe(false);
    expect(required.message).toContain('联系电话');
    expect(required.message).not.toContain('现场负责人');
  });

  it('treats whitespace as missing', () => {
    expect(missingRequiredFields({ ...application, activityName: '\n\t ' })).toHaveLength(1);
  });
});

// T13 — a returned case is revised as a new version; the reviewed one survives.
describe('T13 revision versioning', () => {
  it('opens a new version when a returned case goes back to draft', () => {
    expect(nextVersionFor('returned', 'draft', 1)).toBe(2);
    expect(nextVersionFor('returned', 'draft', 2)).toBe(3);
  });

  it('keeps the version for every other transition', () => {
    const otherTransitions: Array<[CaseStatus, CaseStatus]> = [
      ['draft', 'submitted'],
      ['submitted', 'under_review'],
      ['under_review', 'returned'],
      ['under_review', 'approved'],
      ['approved', 'completed'],
    ];
    for (const [from, to] of otherTransitions) {
      expect(nextVersionFor(from, to, 3)).toBe(3);
    }
  });

  it('bumps the version exactly on the transition the state machine allows', () => {
    for (const from of caseStatuses) {
      for (const to of caseStatuses) {
        const bumps = nextVersionFor(from, to, 1) === 2;
        if (bumps) {
          expect([from, to]).toEqual(['returned', 'draft']);
          expect(canTransition(from, to, 'student')).toBe(true);
        }
      }
    }
  });
});

// T14 — an approval is reachable once; repeating it has no second transition.
describe('T14 repeated approval', () => {
  it('cannot re-approve an already approved case', () => {
    expect(canTransition('under_review', 'approved', 'admin')).toBe(true);
    expect(canTransition('approved', 'approved', 'admin')).toBe(false);
    expect(canTransition('completed', 'approved', 'admin')).toBe(false);
  });

  it('has no transition at all out of the archived state', () => {
    for (const to of caseStatuses) {
      expect(canTransition('completed', to, 'admin')).toBe(false);
      expect(canTransition('completed', to, 'student')).toBe(false);
    }
  });
});
