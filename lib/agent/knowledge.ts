import { ruleCatalog } from '@/lib/domain/rules';
import type { ValidationResult, VenueApplication } from '@/lib/domain/types';
import type { AgentTaskType } from './types';

export type KnowledgeSnippet = {
  id: string;
  title: string;
  source: string;
  content: string;
};

/**
 * Which knowledge documents back which rule. Retrieval over three curated
 * documents is a lookup, not a vector search — the value here is that every
 * snippet handed to the model is traceable to the rule that needed it, and the
 * reviewer can see exactly what the model was allowed to read.
 */
function knowledgeForRules(ruleIds: readonly string[]) {
  return ruleIds.flatMap(
    (ruleId) =>
      ruleCatalog.find((rule) => rule.id === ruleId)?.knowledgeRefs ?? [],
  );
}

export function selectKnowledgeIds({
  taskType,
  application,
  validation,
}: {
  taskType: AgentTaskType;
  application: VenueApplication;
  validation?: ValidationResult;
}): string[] {
  if (taskType === 'form_assist') {
    // No validation has run yet, so scope to the rules that govern filling in
    // the form: required fields always, equipment only when some was requested.
    const ruleIds = ['VENUE-REQ-001', ...(application.equipment.length ? ['VENUE-EQP-001'] : [])];
    return [...new Set(knowledgeForRules(ruleIds))];
  }

  if (taskType === 'return_message_draft') {
    // A return notice only needs the basis for the rules that actually failed.
    const failed = validation?.results.filter((item) => !item.passed) ?? [];
    const ids = knowledgeForRules(failed.map((item) => item.ruleId));
    return [...new Set(ids.length ? ids : ['KB-VENUE-001'])];
  }

  // A review brief covers the whole case, so the reviewer sees every basis used.
  return [...new Set(knowledgeForRules(ruleCatalog.map((rule) => rule.id)))];
}
