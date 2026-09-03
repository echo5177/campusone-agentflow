import { describe, expect, it } from 'vitest';

import { demoBookings, demoVenues } from '@/lib/demo/data';
import { ruleCatalog, validateVenueApplication } from '@/lib/domain/rules';
import { campusWallClock, formatMinutes, openingMinutes } from '@/lib/domain/time';
import type { VenueApplication } from '@/lib/domain/types';

const activityCenter = demoVenues.find((venue) => venue.id === 'activity-center')!;

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

const hoursRule = (candidate: VenueApplication) =>
  validateVenueApplication(candidate, activityCenter, demoBookings).results.find(
    (result) => result.ruleId === 'VENUE-HOUR-001',
  )!;

describe('campus wall clock', () => {
  // A worker runs in UTC. Reading hours off a Date would put this 19:00 booking
  // at 11:00 and silently change which side of closing time it falls on.
  it('reads local campus time regardless of the input offset', () => {
    expect(campusWallClock(new Date('2026-09-08T19:00:00+08:00'))).toEqual({
      day: '2026-09-08',
      minutes: 19 * 60,
    });
    expect(campusWallClock(new Date('2026-09-08T11:00:00Z'))).toEqual({
      day: '2026-09-08',
      minutes: 19 * 60,
    });
  });

  it('rolls the campus day forward across the UTC date boundary', () => {
    expect(campusWallClock(new Date('2026-09-07T17:30:00Z'))).toEqual({
      day: '2026-09-08',
      minutes: 90,
    });
  });

  it('parses and formats opening hours', () => {
    expect(openingMinutes('08:30')).toBe(510);
    expect(openingMinutes('22:00')).toBe(1320);
    expect(openingMinutes('bogus')).toBeNull();
    expect(openingMinutes('08:75')).toBeNull();
    expect(formatMinutes(510)).toBe('08:30');
  });
});

describe('VENUE-HOUR-001', () => {
  it('is declared in the rule catalog with a knowledge basis', () => {
    const rule = ruleCatalog.find((item) => item.id === 'VENUE-HOUR-001')!;
    expect(rule.knowledgeRefs).toContain('KB-VENUE-003');
  });

  it('accepts a booking inside the venue opening hours', () => {
    expect(hoursRule(application).passed).toBe(true);
  });

  it('rejects a booking that starts before the venue opens', () => {
    const result = hoursRule({
      ...application,
      startTime: '2026-09-08T07:00:00+08:00',
      endTime: '2026-09-08T09:00:00+08:00',
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('08:00');
  });

  it('rejects a booking that runs past closing time', () => {
    const result = hoursRule({
      ...application,
      startTime: '2026-09-08T21:00:00+08:00',
      endTime: '2026-09-08T23:00:00+08:00',
    });
    expect(result.passed).toBe(false);
  });

  it('rejects an activity that spills into the next campus day', () => {
    const result = hoursRule({
      ...application,
      startTime: '2026-09-08T21:00:00+08:00',
      endTime: '2026-09-09T01:00:00+08:00',
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('同一天');
  });

  it('reports that it could not evaluate an invalid time range', () => {
    const result = hoursRule({ ...application, endTime: 'not-a-date' });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('无法检查');
  });

  it('cites the venue hours it checked against', () => {
    expect(hoursRule(application).evidenceRefs).toContain('VENUE:activity-center:hours');
  });
});
