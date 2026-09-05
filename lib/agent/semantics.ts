import type { ReturnMessageOutput } from './schemas';
import { AgentValidationError } from './validator';

/**
 * Schema and evidence checks catch malformed output and invented identifiers,
 * but not a draft that is well-formed and simply says the wrong thing. Handed a
 * form that passes every rule, the model drafted "您的场地申请已提交，我们正在
 * 处理中。请留意后续通知。" for a case that had actually been sent back — the
 * opposite of the instruction the applicant needed.
 *
 * This check is deliberately narrow: one task, one contradiction, phrases that
 * only make sense when a case is still awaiting a decision. It is not a general
 * attempt to police tone, and it is repairable — the model gets the complaint
 * back and usually corrects on the second attempt.
 */
const awaitingDecisionPhrases = [
  '等待审批',
  '等待审核',
  '正在处理',
  '正在审核',
  '已批准',
  '已通过审批',
  '审批通过',
  '无需修改',
  '无须修改',
  '留意后续通知',
  '请耐心等待',
];

/** Wording that tells the applicant their case is still moving on its own. */
export function awaitingDecisionClaims(text: string): string[] {
  return awaitingDecisionPhrases.filter((phrase) => text.includes(phrase));
}

export function assertReturnNoticeSemantics(
  output: ReturnMessageOutput,
  context: { status: string },
) {
  if (context.status !== 'returned') return;
  const text = [output.message, ...output.requiredActions].join('\n');
  const conflicts = awaitingDecisionClaims(text);
  if (conflicts.length > 0) {
    throw new AgentValidationError(
      'SEMANTIC_CONFLICT',
      `申请当前为“已退回”，退回通知不得出现“${conflicts.join('、')}”这类等待审批的表述。`,
    );
  }
}
