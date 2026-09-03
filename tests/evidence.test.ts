import { describe, expect, it } from 'vitest';

import { validEvidenceRefs, validRuleIds } from '@/lib/agent/evidence';
import { selectKnowledgeIds } from '@/lib/agent/knowledge';
import { agentTaskTypes } from '@/lib/agent/types';
import { demoBookings, demoKnowledge, demoVenues } from '@/lib/demo/data';
import { ruleCatalog, validateVenueApplication } from '@/lib/domain/rules';
import { venueApplicationFields } from '@/lib/domain/types';
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

describe('evidence allowlists', () => {
  it('lists every application field exactly once', () => {
    expect([...venueApplicationFields].sort()).toEqual(Object.keys(application).sort());
  });

  it('accepts every rule id and evidence ref the engine can emit', () => {
    // Cover both the happy path and every failure branch, since failing rules
    // cite different evidence (BOOKING:*, FORM:venueId) than passing ones.
    const cases: VenueApplication[] = [
      application,
      { ...application, attendees: 999 },
      { ...application, equipment: ['直播'] },
      { ...application, startTime: '2026-09-08T15:00:00+08:00', endTime: '2026-09-08T16:00:00+08:00' },
      { ...application, venueId: 'no-such-venue' },
      { ...application, activityName: '', startTime: 'not-a-date' },
    ];

    for (const candidate of cases) {
      const venue = demoVenues.find((item) => item.id === candidate.venueId);
      const { results } = validateVenueApplication(candidate, venue, demoBookings);
      for (const result of results) {
        expect(validRuleIds.has(result.ruleId)).toBe(true);
        for (const reference of result.evidenceRefs) {
          expect(
            validEvidenceRefs.has(reference),
            `evidence ref ${reference} is not on the allowlist`,
          ).toBe(true);
        }
      }
    }
  });

  it('allows every seeded knowledge document to be cited', () => {
    for (const document of demoKnowledge) {
      expect(validEvidenceRefs.has(document.id)).toBe(true);
    }
  });
});

describe('knowledge selection', () => {
  it('only ever selects documents that exist', () => {
    const known = new Set(demoKnowledge.map((document) => document.id));
    const validation = validateVenueApplication(
      { ...application, attendees: 999, equipment: ['直播'] },
      demoVenues[0],
      demoBookings,
    );
    for (const taskType of agentTaskTypes) {
      const ids = selectKnowledgeIds({ taskType, application, validation });
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(known.has(id)).toBe(true);
    }
  });

  it('scopes a return notice to the rules that actually failed', () => {
    const validation = validateVenueApplication(
      { ...application, equipment: ['直播'] },
      demoVenues[0],
      demoBookings,
    );
    expect(
      selectKnowledgeIds({ taskType: 'return_message_draft', application, validation }),
    ).toEqual(['KB-VENUE-002']);
  });

  it('gives a review brief the basis for every rule', () => {
    const expected = new Set(ruleCatalog.flatMap((rule) => rule.knowledgeRefs));
    const selected = selectKnowledgeIds({ taskType: 'review_brief', application });
    expect(new Set(selected)).toEqual(expected);
  });
});
