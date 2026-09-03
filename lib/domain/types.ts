export const caseStatuses = [
  'draft',
  'submitted',
  'under_review',
  'returned',
  'approved',
  'completed',
] as const;

export type CaseStatus = (typeof caseStatuses)[number];
export type ActorRole = 'student' | 'admin' | 'system';

export type VenueApplication = {
  activityName: string;
  organization: string;
  venueId: string;
  attendees: number;
  startTime: string;
  endTime: string;
  description: string;
  contactName: string;
  contactPhone: string;
  equipment: string[];
};

/**
 * Field names the agent may cite as `FORM:<field>` evidence. `satisfies` blocks
 * invented names; `tests/evidence.test.ts` blocks missing ones.
 */
export const venueApplicationFields = [
  'activityName',
  'organization',
  'venueId',
  'attendees',
  'startTime',
  'endTime',
  'description',
  'contactName',
  'contactPhone',
  'equipment',
] as const satisfies readonly (keyof VenueApplication)[];

export type Venue = {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  availableFrom: string;
  availableTo: string;
};

export type ExistingBooking = {
  venueId: string;
  startTime: string;
  endTime: string;
  title: string;
};

export type RuleResult = {
  ruleId: string;
  label: string;
  passed: boolean;
  message: string;
  evidenceRefs: string[];
};

export type ValidationResult = {
  passed: boolean;
  results: RuleResult[];
};

