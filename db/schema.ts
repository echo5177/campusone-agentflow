import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { CaseStatus, VenueApplication } from '@/lib/domain/types';

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  equipment: text('equipment', { mode: 'json' }).$type<string[]>().notNull(),
  availableFrom: text('available_from').notNull(),
  availableTo: text('available_to').notNull(),
});

export const cases = sqliteTable(
  'cases',
  {
    id: text('id').primaryKey(),
    caseType: text('case_type').notNull(),
    applicantId: text('applicant_id').notNull(),
    applicantName: text('applicant_name').notNull(),
    status: text('status').$type<CaseStatus>().notNull(),
    currentVersion: integer('current_version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_cases_applicant_id').on(table.applicantId),
    index('idx_cases_status_updated_at').on(table.status, table.updatedAt),
  ],
);

export const caseVersions = sqliteTable(
  'case_versions',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id),
    version: integer('version').notNull(),
    formData: text('form_data', { mode: 'json' }).$type<VenueApplication>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_case_versions_case_version').on(table.caseId, table.version),
  ],
);

export const caseEvents = sqliteTable(
  'case_events',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id),
    eventType: text('event_type').notNull(),
    actorRole: text('actor_role').notNull(),
    actorId: text('actor_id').notNull(),
    beforeState: text('before_state'),
    afterState: text('after_state'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_case_events_case_created_at').on(table.caseId, table.createdAt),
    uniqueIndex('idx_case_events_idempotency_key').on(table.idempotencyKey),
  ],
);

export const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  version: text('version').notNull(),
  source: text('source').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const knowledgeDocuments = sqliteTable('knowledge_documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
});

export const aiRuns = sqliteTable(
  'ai_runs',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id').references(() => cases.id),
    taskType: text('task_type').notNull(),
    promptVersion: text('prompt_version').notNull(),
    model: text('model').notNull(),
    inputDigest: text('input_digest').notNull(),
    rawResponse: text('raw_response').notNull(),
    parsedOutput: text('parsed_output', { mode: 'json' }).$type<unknown>(),
    validationStatus: text('validation_status').notNull(),
    errorCode: text('error_code'),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_ai_runs_case_created_at').on(table.caseId, table.createdAt)],
);

