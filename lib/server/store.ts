import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  aiRuns,
  caseEvents,
  cases,
  caseVersions,
  knowledgeDocuments,
  rules,
  venues,
} from '@/db/schema';
import type { KnowledgeSnippet } from '@/lib/agent/knowledge';
import { demoBookings, demoKnowledge, demoVenues } from '@/lib/demo/data';
import { initialApplication } from '@/lib/demo/initial-application';
import { ruleCatalog } from '@/lib/domain/rules';
import { assertTransition, nextVersionFor } from '@/lib/domain/state-machine';
import type {
  ActorRole,
  CaseStatus,
  VenueApplication,
} from '@/lib/domain/types';

/**
 * Every case is scoped to the visitor's session. The deployed demo link is meant
 * to be opened by several reviewers at once; with one shared global case, one
 * person clicking 提交申请 would move the workflow under everyone else's feet.
 */

const now = () => new Date().toISOString();

/** Event metadata is untyped JSON, so read the reason without stringifying an object. */
function readReason(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.reason;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Bump whenever venues, rules or knowledge documents change. A deployed D1 keeps
 * its rows across releases, so without this the demo would keep serving the
 * reference data from whenever it was first seeded.
 */
const REFERENCE_DATA_VERSION = '2026.09.2';

const ruleRows = () =>
  ruleCatalog.map((rule) => ({
    id: rule.id,
    label: rule.label,
    version: REFERENCE_DATA_VERSION,
    source: '模拟场地管理规则',
    enabled: true,
  }));

/** Replaces venues, rules and knowledge. Nothing references them by foreign key. */
async function reseedReferenceData() {
  const db = getDb();
  await db.batch([
    db.delete(venues),
    db.delete(rules),
    db.delete(knowledgeDocuments),
    db.insert(venues).values(demoVenues),
    db.insert(rules).values(ruleRows()),
    db.insert(knowledgeDocuments).values(demoKnowledge),
  ]);
}

/**
 * Venues, rules and knowledge are shared by every visitor, so they are seeded
 * once for the database rather than once per case, and refreshed only when the
 * reference data version moves.
 */
async function ensureReferenceData() {
  const db = getDb();
  const [current] = await db.select({ version: rules.version }).from(rules).limit(1);
  if (current?.version === REFERENCE_DATA_VERSION) return;
  await reseedReferenceData();
}

export async function ensureDemoSeeded(caseId: string) {
  await ensureReferenceData();
  const db = getDb();
  const [existing] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  if (existing) return;

  const timestamp = now();
  await db.batch([
    db.insert(cases).values({
      id: caseId,
      caseType: 'venue_application',
      applicantId: 'student-lin',
      applicantName: '林同学',
      status: 'draft',
      currentVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    db.insert(caseVersions).values({
      id: `${caseId}-V1`,
      caseId: caseId,
      version: 1,
      formData: initialApplication,
      createdBy: 'student-lin',
      createdAt: timestamp,
    }),
    db.insert(caseEvents).values({
      id: crypto.randomUUID(),
      caseId: caseId,
      eventType: 'case_created',
      actorRole: 'student',
      actorId: 'student-lin',
      beforeState: null,
      afterState: 'draft',
      metadata: { version: 1 },
      idempotencyKey: `${caseId}-seed-case-created`,
      createdAt: timestamp,
    }),
  ]);
}

export async function getDemoSnapshot(caseId: string) {
  await ensureDemoSeeded(caseId);
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId));
  const [currentVersion] = await db
    .select()
    .from(caseVersions)
    .where(
      and(
        eq(caseVersions.caseId, caseId),
        eq(caseVersions.version, caseRow.currentVersion),
      ),
    );
  const versionRows = await db
    .select()
    .from(caseVersions)
    .where(eq(caseVersions.caseId, caseId))
    .orderBy(desc(caseVersions.version));
  const eventRows = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, caseId))
    .orderBy(asc(caseEvents.createdAt));
  const runRows = await db
    .select()
    .from(aiRuns)
    .where(eq(aiRuns.caseId, caseId))
    .orderBy(desc(aiRuns.createdAt));

  return {
    case: caseRow,
    application: currentVersion.formData,
    versions: versionRows,
    events: eventRows,
    aiRuns: runRows,
    venues: await db.select().from(venues),
    // Static demo reference data rather than a table: the conflict rule cites it,
    // so the UI needs it to explain why a slot was refused.
    bookings: demoBookings,
    rules: await db.select().from(rules),
    knowledge: await db.select().from(knowledgeDocuments),
  };
}

export async function updateDraft(
  caseId: string,
  application: VenueApplication,
  actor: { role: ActorRole; actorId: string },
) {
  await ensureDemoSeeded(caseId);
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId));
  if (caseRow.status !== 'draft') {
    throw new Error(`CASE_NOT_EDITABLE:${caseRow.status}`);
  }
  if (actor.role !== 'student') {
    throw new Error(`CASE_NOT_EDITABLE_BY:${actor.role}`);
  }
  await db
    .update(caseVersions)
    .set({ formData: application, createdBy: actor.actorId })
    .where(
      and(
        eq(caseVersions.caseId, caseId),
        eq(caseVersions.version, caseRow.currentVersion),
      ),
    );
  await db
    .update(cases)
    .set({ updatedAt: now() })
    .where(eq(cases.id, caseId));
  return getDemoSnapshot(caseId);
}

export async function transitionCase({
  caseId,
  to,
  role,
  actorId,
  metadata = {},
  revisedApplication,
}: {
  caseId: string;
  to: CaseStatus;
  role: ActorRole;
  actorId: string;
  metadata?: Record<string, unknown>;
  revisedApplication?: VenueApplication;
}) {
  await ensureDemoSeeded(caseId);
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId));

  // Derived server-side from the state the transition starts at, so a retried or
  // double-clicked request carries the same key and collapses into one event.
  // A client-supplied key with a random suffix — as this used to send — made the
  // idempotency index decorative.
  const idempotencyKey = `${caseId}-v${caseRow.currentVersion}-${caseRow.status}-to-${to}`;
  const [duplicate] = await db
    .select({ id: caseEvents.id })
    .from(caseEvents)
    .where(eq(caseEvents.idempotencyKey, idempotencyKey))
    .limit(1);
  if (duplicate) return getDemoSnapshot(caseId);

  assertTransition(caseRow.status, to, role);

  const timestamp = now();
  const nextVersion = nextVersionFor(caseRow.status, to, caseRow.currentVersion);
  const updateCase = db
    .update(cases)
    .set({ status: to, currentVersion: nextVersion, updatedAt: timestamp })
    .where(eq(cases.id, caseId));
  const insertEvent = db.insert(caseEvents).values({
    id: crypto.randomUUID(),
    caseId: caseId,
    eventType: `${caseRow.status}_to_${to}`,
    actorRole: role,
    actorId,
    beforeState: caseRow.status,
    afterState: to,
    metadata: { ...metadata, version: nextVersion },
    idempotencyKey,
    createdAt: timestamp,
  });
  const opensNewVersion = nextVersion !== caseRow.currentVersion;
  if (opensNewVersion && !revisedApplication) throw new Error('REVISION_REQUIRED');
  // A return is an instruction to the applicant, so it has to say what to change.
  // Without this the reason was a fixed string nobody wrote and nobody could read.
  if (to === 'returned' && !readReason(metadata)) {
    throw new Error('RETURN_REASON_REQUIRED');
  }

  const statements: [typeof updateCase, ...unknown[]] = [updateCase, insertEvent];
  if (opensNewVersion) {
    statements.push(
      db.insert(caseVersions).values({
        id: `${caseId}-V${nextVersion}`,
        caseId: caseId,
        version: nextVersion,
        formData: revisedApplication as VenueApplication,
        createdBy: actorId,
        createdAt: timestamp,
      }),
    );
  }

  try {
    await db.batch(statements as Parameters<typeof db.batch>[0]);
  } catch (error) {
    // Two requests can pass the duplicate check before either writes. The unique
    // index on idempotency_key is what actually decides; the loser reports the
    // winner's result rather than a conflict the user never caused.
    const [written] = await db
      .select({ id: caseEvents.id })
      .from(caseEvents)
      .where(eq(caseEvents.idempotencyKey, idempotencyKey))
      .limit(1);
    if (!written) throw error;
  }
  return getDemoSnapshot(caseId);
}

/** Clears only this session's case. Other visitors' demos are untouched. */
export async function resetDemo(caseId: string) {
  const db = getDb();
  await db.batch([
    db.delete(aiRuns).where(eq(aiRuns.caseId, caseId)),
    db.delete(caseEvents).where(eq(caseEvents.caseId, caseId)),
    db.delete(caseVersions).where(eq(caseVersions.caseId, caseId)),
    db.delete(cases).where(eq(cases.id, caseId)),
  ]);
  await ensureDemoSeeded(caseId);
  return getDemoSnapshot(caseId);
}

export async function recordAiRun(run: typeof aiRuns.$inferInsert) {
  const db = getDb();
  await db.insert(aiRuns).values(run);
}

/**
 * Status plus the most recent human return reason. The return-notice task needs
 * both: given only a valid form it once drafted "已提交，等待审批" for a case that
 * had in fact been sent back.
 */
export async function getReturnContext(caseId: string): Promise<{
  status: CaseStatus;
  returnReason: string | null;
  returnedAt: string | null;
}> {
  await ensureDemoSeeded(caseId);
  const db = getDb();
  const [caseRow] = await db
    .select({ status: cases.status })
    .from(cases)
    .where(eq(cases.id, caseId));
  const [latestReturn] = await db
    .select({ metadata: caseEvents.metadata, createdAt: caseEvents.createdAt })
    .from(caseEvents)
    .where(and(eq(caseEvents.caseId, caseId), eq(caseEvents.afterState, 'returned')))
    .orderBy(desc(caseEvents.createdAt))
    .limit(1);
  const reason = readReason(latestReturn?.metadata);
  return {
    status: caseRow.status,
    returnReason: reason.length > 0 ? reason : null,
    returnedAt: latestReturn?.createdAt ?? null,
  };
}

/** Loads the knowledge documents an agent task is allowed to read, in catalog order. */
export async function getKnowledgeByIds(ids: string[]): Promise<KnowledgeSnippet[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeDocuments)
    .where(inArray(knowledgeDocuments.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}
