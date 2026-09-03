import { demoBookings, demoKnowledge, demoVenues } from '@/lib/demo/data';
import { ruleCatalog } from '@/lib/domain/rules';
import { venueApplicationFields } from '@/lib/domain/types';

/**
 * The agent output allowlists are derived from the same data the rule engine and
 * the seeded database use. Hand-maintaining them meant that adding one venue or
 * one existing booking would make the model's own (correct) citation fail
 * EVIDENCE_NOT_FOUND during a demo.
 */
export const validRuleIds = new Set<string>(ruleCatalog.map((rule) => rule.id));

export const validEvidenceRefs = new Set<string>([
  'FORM-SCHEMA-1.2',
  ...venueApplicationFields.map((field) => `FORM:${field}`),
  ...demoVenues.flatMap((venue) => [
    `VENUE:${venue.id}:capacity`,
    `VENUE:${venue.id}:equipment`,
  ]),
  ...demoBookings.map((booking) => `BOOKING:${booking.title}`),
  ...demoKnowledge.map((document) => document.id),
]);
