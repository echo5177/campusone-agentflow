import { describe, expect, it } from 'vitest';

import { selectKnowledgeIds } from '@/lib/agent/knowledge';
import { agentTaskTypes } from '@/lib/agent/types';
import { demoBookings, demoVenues } from '@/lib/demo/data';
import { validateVenueApplication } from '@/lib/domain/rules';
import type { VenueApplication } from '@/lib/domain/types';

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

const venue = demoVenues.find((item) => item.id === 'activity-center')!;
const check = (candidate: VenueApplication) =>
  validateVenueApplication(candidate, venue, demoBookings);

// Regression: form_assist used to receive the bare form with no rule results, so
// asked to explain itself the live model stated an 800-person booking "符合场地
// 申请要求" while VENUE-CAP-001 was failing. Every agent task must now be handed
// the deterministic verdict, and the failures must be reportable to the UI.
describe('compliance is decided by the rule engine, not the assistant', () => {
  it('fails capacity for a booking far over the venue limit', () => {
    const { passed, results } = check({ ...application, attendees: 800 });
    const capacity = results.find((item) => item.ruleId === 'VENUE-CAP-001')!;
    expect(passed).toBe(false);
    expect(capacity.passed).toBe(false);
    expect(capacity.message).toContain('800');
    expect(capacity.message).toContain('120');
  });

  it('reports every failing rule with an id, label and message', () => {
    const overCapacityAtNight = {
      ...application,
      attendees: 800,
      startTime: '2026-09-08T23:00:00+08:00',
      endTime: '2026-09-08T23:59:00+08:00',
    };
    const issues = check(overCapacityAtNight).results.filter((item) => !item.passed);
    expect(issues.map((item) => item.ruleId).sort()).toEqual([
      'VENUE-CAP-001',
      'VENUE-HOUR-001',
    ]);
    for (const issue of issues) {
      expect(issue.label.length).toBeGreaterThan(0);
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  it('has nothing to report when every rule passes', () => {
    expect(check(application).results.filter((item) => !item.passed)).toEqual([]);
  });

  // form_assist selects knowledge without a validation argument, so a task that
  // forgets to pass one would still look fine here — the compile-time signature
  // is what guarantees the route supplies it.
  it('selects knowledge for every task with a failing validation present', () => {
    const validation = check({ ...application, attendees: 800 });
    for (const taskType of agentTaskTypes) {
      expect(
        selectKnowledgeIds({ taskType, application, validation }).length,
      ).toBeGreaterThan(0);
    }
  });
});
