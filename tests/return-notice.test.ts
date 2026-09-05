import { describe, expect, it } from 'vitest';

import { MAX_ATTEMPTS, shouldRepair } from '@/lib/agent/retry';
import {
  assertReturnNoticeSemantics,
  awaitingDecisionClaims,
} from '@/lib/agent/semantics';
import { AgentValidationError } from '@/lib/agent/validator';
import { comparableFields, latestReturnReason } from '@/components/campus/types';
import type { ReturnMessageOutput } from '@/lib/agent/schemas';
import type { VenueApplication } from '@/lib/domain/types';

const notice = (
  message: string,
  requiredActions: string[] = ['请补充现场秩序维护安排。'],
): ReturnMessageOutput => ({
  taskType: 'return_message_draft',
  message,
  requiredActions,
  evidenceRefs: ['KB-VENUE-001'],
  requiresHumanConfirmation: true,
});

// Regression: handed a form that passed every rule and no case state, the live
// model drafted "您的场地申请已提交，我们正在处理中。请留意后续通知。" for a case
// that had actually been returned — the opposite of what the applicant needed.
describe('return notice must not tell a returned applicant to wait', () => {
  it('rejects the wording that was actually produced', () => {
    expect(() =>
      assertReturnNoticeSemantics(
        notice('您的场地申请已提交，我们正在处理中。请留意后续通知。', [
          '等待审批结果',
        ]),
        { status: 'returned' },
      ),
    ).toThrow(AgentValidationError);
  });

  it('reports the conflict as SEMANTIC_CONFLICT and names the phrase', () => {
    try {
      assertReturnNoticeSemantics(notice('申请已提交，请耐心等待审批。'), {
        status: 'returned',
      });
      throw new Error('expected the contradiction to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentValidationError);
      expect((error as AgentValidationError).code).toBe('SEMANTIC_CONFLICT');
      expect((error as Error).message).toContain('等待审批');
    }
  });

  it('accepts a draft that asks the applicant to revise and resubmit', () => {
    expect(() =>
      assertReturnNoticeSemantics(
        notice('你提交的申请已被退回，请按下列意见修改后重新提交。', [
          '管理员退回意见：请补充现场秩序维护安排。',
        ]),
        { status: 'returned' },
      ),
    ).not.toThrow();
  });

  it('checks the required actions, not only the message', () => {
    expect(() =>
      assertReturnNoticeSemantics(
        notice('申请已退回，请修改后重新提交。', ['无需修改，等待审核即可。']),
        { status: 'returned' },
      ),
    ).toThrow(AgentValidationError);
  });

  it('does not police wording for a case that is not returned', () => {
    expect(() =>
      assertReturnNoticeSemantics(notice('申请已提交，正在处理中。'), {
        status: 'submitted',
      }),
    ).not.toThrow();
  });

  it('finds every conflicting phrase so the repair hint is specific', () => {
    // Compared as a set: the order depends on the phrase list, not the caller.
    expect(new Set(awaitingDecisionClaims('已批准，无需修改，请耐心等待'))).toEqual(
      new Set(['已批准', '无需修改', '请耐心等待']),
    );
    expect(awaitingDecisionClaims('请修改后重新提交')).toEqual([]);
  });

  it('re-asks the model once when the draft contradicts the state', () => {
    expect(
      shouldRepair({
        mode: 'live',
        faultMode: 'none',
        errorCode: 'SEMANTIC_CONFLICT',
        attempt: 1,
      }),
    ).toBe(true);
    expect(
      shouldRepair({
        mode: 'live',
        faultMode: 'none',
        errorCode: 'SEMANTIC_CONFLICT',
        attempt: MAX_ATTEMPTS,
      }),
    ).toBe(false);
  });
});

describe('return reason recorded on the event', () => {
  const event = (afterState: string, reason?: unknown) => ({
    afterState,
    metadata: reason === undefined ? {} : { reason },
  });

  it('reads the most recent administrator reason', () => {
    expect(
      latestReturnReason([
        event('submitted'),
        event('returned', '第一次退回'),
        event('draft'),
        event('returned', '请补充现场秩序维护安排'),
      ]),
    ).toBe('请补充现场秩序维护安排');
  });

  it('ignores events that carry no usable reason', () => {
    expect(latestReturnReason([event('returned', '   ')])).toBeNull();
    expect(latestReturnReason([event('returned', 42)])).toBeNull();
    expect(latestReturnReason([event('approved', '不是退回')])).toBeNull();
    expect(latestReturnReason([])).toBeNull();
  });
});

describe('version comparison', () => {
  const base: VenueApplication = {
    activityName: '2026 秋季社团招新宣讲会',
    organization: '学生创新协会',
    venueId: 'activity-center',
    attendees: 80,
    startTime: '2026-09-08T19:00:00+08:00',
    endTime: '2026-09-08T21:00:00+08:00',
    description: '面向全校新生介绍协会方向与年度计划。',
    contactName: '林同学',
    contactPhone: '13800000000',
    equipment: ['投影', '无线麦克风'],
  };

  it('compares every field the form can change', () => {
    expect(comparableFields.map(({ key }) => key).sort()).toEqual(
      Object.keys(base).sort(),
    );
  });

  it('labels every compared field', () => {
    for (const field of comparableFields) {
      expect(field.label.length).toBeGreaterThan(0);
    }
  });
});
