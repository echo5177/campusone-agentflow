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
import { demoKnowledge, demoVenues } from '@/lib/demo/data';
import { ruleCatalog } from '@/lib/domain/rules';
import { assertTransition } from '@/lib/domain/state-machine';
import type {
  ActorRole,
  CaseStatus,
  VenueApplication,
} from '@/lib/domain/types';

export const DEMO_CASE_ID = 'CA-2026-0902-01';

const now = () => new Date().toISOString();

const initialApplication: VenueApplication = {
  activityName: '2026 秋季社团招新宣讲会',
  organization: '学生创新协会',
  venueId: 'activity-center',
  attendees: 80,
  startTime: '2026-09-08T19:00:00+08:00',
  endTime: '2026-09-08T21:00:00+08:00',
  description:
    '面向全校新生介绍协会方向与年度计划，现场包含项目展示、成员分享和招新答疑。',
  contactName: '林同学',
  contactPhone: '13800000000',
  equipment: ['投影', '无线麦克风', '基础扩声'],
};


export async function ensureDemoSeeded() {
  const db = getDb();
  const [existing] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(eq(cases.id, DEMO_CASE_ID))
    .limit(1);
  if (existing) return;

  const timestamp = now();
  await db.batch([
    db.insert(venues).values(demoVenues),
    db.insert(rules).values(
      ruleCatalog.map((rule) => ({
        id: rule.id,
        label: rule.label,
        version: '2026.09',
        source: '模拟场地管理规则',
        enabled: true,
      })),
    ),
    db.insert(knowledgeDocuments).values(demoKnowledge),
    db.insert(cases).values({
      id: DEMO_CASE_ID,
      caseType: 'venue_application',
      applicantId: 'student-lin',
      applicantName: '林同学',
      status: 'draft',
      currentVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    db.insert(caseVersions).values({
      id: `${DEMO_CASE_ID}-V1`,
      caseId: DEMO_CASE_ID,
      version: 1,
      formData: initialApplication,
      createdBy: 'student-lin',
      createdAt: timestamp,
    }),
    db.insert(caseEvents).values({
      id: crypto.randomUUID(),
      caseId: DEMO_CASE_ID,
      eventType: 'case_created',
      actorRole: 'student',
      actorId: 'student-lin',
      beforeState: null,
      afterState: 'draft',
      metadata: { version: 1 },
      idempotencyKey: 'seed-case-created',
      createdAt: timestamp,
    }),
  ]);
}

export async function getDemoSnapshot() {
  await ensureDemoSeeded();
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, DEMO_CASE_ID));
  const [currentVersion] = await db
    .select()
    .from(caseVersions)
    .where(
      and(
        eq(caseVersions.caseId, DEMO_CASE_ID),
        eq(caseVersions.version, caseRow.currentVersion),
      ),
    );
  const versionRows = await db
    .select()
    .from(caseVersions)
    .where(eq(caseVersions.caseId, DEMO_CASE_ID))
    .orderBy(desc(caseVersions.version));
  const eventRows = await db
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.caseId, DEMO_CASE_ID))
    .orderBy(asc(caseEvents.createdAt));
  const runRows = await db
    .select()
    .from(aiRuns)
    .where(eq(aiRuns.caseId, DEMO_CASE_ID))
    .orderBy(desc(aiRuns.createdAt));

  return {
    case: caseRow,
    application: currentVersion.formData,
    versions: versionRows,
    events: eventRows,
    aiRuns: runRows,
    venues: await db.select().from(venues),
    rules: await db.select().from(rules),
    knowledge: await db.select().from(knowledgeDocuments),
  };
}

export async function updateDraft(
  application: VenueApplication,
  actor: { role: ActorRole; actorId: string },
) {
  await ensureDemoSeeded();
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, DEMO_CASE_ID));
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
        eq(caseVersions.caseId, DEMO_CASE_ID),
        eq(caseVersions.version, caseRow.currentVersion),
      ),
    );
  await db
    .update(cases)
    .set({ updatedAt: now() })
    .where(eq(cases.id, DEMO_CASE_ID));
  return getDemoSnapshot();
}

export async function transitionCase({
  to,
  role,
  actorId,
  metadata = {},
  revisedApplication,
}: {
  to: CaseStatus;
  role: ActorRole;
  actorId: string;
  metadata?: Record<string, unknown>;
  revisedApplication?: VenueApplication;
}) {
  await ensureDemoSeeded();
  const db = getDb();
  const [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, DEMO_CASE_ID));

  // Derived server-side from the state the transition starts at, so a retried or
  // double-clicked request carries the same key and collapses into one event.
  // A client-supplied key with a random suffix — as this used to send — made the
  // idempotency index decorative.
  const idempotencyKey = `${DEMO_CASE_ID}-v${caseRow.currentVersion}-${caseRow.status}-to-${to}`;
  const [duplicate] = await db
    .select({ id: caseEvents.id })
    .from(caseEvents)
    .where(eq(caseEvents.idempotencyKey, idempotencyKey))
    .limit(1);
  if (duplicate) return getDemoSnapshot();

  assertTransition(caseRow.status, to, role);

  const timestamp = now();
  const nextVersion =
    caseRow.status === 'returned' && to === 'draft'
      ? caseRow.currentVersion + 1
      : caseRow.currentVersion;
  const updateCase = db
    .update(cases)
    .set({ status: to, currentVersion: nextVersion, updatedAt: timestamp })
    .where(eq(cases.id, DEMO_CASE_ID));
  const insertEvent = db.insert(caseEvents).values({
    id: crypto.randomUUID(),
    caseId: DEMO_CASE_ID,
    eventType: `${caseRow.status}_to_${to}`,
    actorRole: role,
    actorId,
    beforeState: caseRow.status,
    afterState: to,
    metadata: { ...metadata, version: nextVersion },
    idempotencyKey,
    createdAt: timestamp,
  });
  if (nextVersion !== caseRow.currentVersion) {
    if (!revisedApplication) throw new Error('REVISION_REQUIRED');
    await db.batch([
      updateCase,
      insertEvent,
      db.insert(caseVersions).values({
        id: `${DEMO_CASE_ID}-V${nextVersion}`,
        caseId: DEMO_CASE_ID,
        version: nextVersion,
        formData: revisedApplication,
        createdBy: actorId,
        createdAt: timestamp,
      }),
    ]);
  } else {
    await db.batch([updateCase, insertEvent]);
  }
  return getDemoSnapshot();
}

export async function resetDemo() {
  const db = getDb();
  await db.batch([
    db.delete(aiRuns),
    db.delete(caseEvents),
    db.delete(caseVersions),
    db.delete(cases),
    db.delete(knowledgeDocuments),
    db.delete(rules),
    db.delete(venues),
  ]);
  await ensureDemoSeeded();
  return getDemoSnapshot();
}

export async function recordAiRun(run: typeof aiRuns.$inferInsert) {
  const db = getDb();
  await db.insert(aiRuns).values(run);
}

/** Loads the knowledge documents an agent task is allowed to read, in catalog order. */
export async function getKnowledgeByIds(ids: string[]): Promise<KnowledgeSnippet[]> {
  if (ids.length === 0) return [];
  await ensureDemoSeeded();
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
