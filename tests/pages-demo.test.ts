import { describe, expect, it, vi } from 'vitest';
import { createPagesClient, STORAGE_KEY } from '@/lib/demo/pages-store';
import type { DemoSnapshot, AgentResult } from '@/components/campus/types';
import type { ReturnMessageOutput } from '@/lib/agent/schemas';
import { initialApplication } from '@/lib/demo/initial-application';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
function setup(storage = memoryStorage()) {
  const client = createPagesClient(storage);
  const post = <T = DemoSnapshot>(url: string, body?: unknown) =>
    client.request<T>(url, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const move = (to: string, extra = {}) =>
    post('/api/case', { action: 'transition', to, ...extra });
  const role = (role: string) => post('/api/demo/role', { role });
  const get = () => client.request<DemoSnapshot>('/api/demo');
  return { client, post, move, role, get, storage };
}

describe('browser-only Pages demo', () => {
  it('handles the full return, revision and archive flow without any HTTP call', async () => {
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('NETWORK_FORBIDDEN'));
    try {
      const { move, role, post, get, storage } = setup();
      await move('submitted');
      await role('admin');
      await move('under_review');
      await expect(move('returned')).rejects.toThrow('RETURN_REASON_REQUIRED');
      const reason = '请补充两名秩序维护人员';
      await move('returned', { metadata: { reason } });
      const notice = await post<AgentResult<ReturnMessageOutput>>(
        '/api/agent/return-message',
        { application: initialApplication },
      );
      expect(notice.ok).toBe(true);
      if (notice.ok)
        expect(notice.output.requiredActions.join()).toContain(reason);
      await role('student');
      const revised = {
        ...initialApplication,
        description:
          initialApplication.description + '现场安排两名秩序维护人员。',
      };
      await move('draft', { revisedApplication: revised });
      await move('submitted');
      await role('admin');
      await move('under_review');
      await move('approved');
      await move('completed');
      const s = await get();
      expect(s.case.status).toBe('completed');
      expect(s.case.currentVersion).toBe(2);
      expect(s.versions.map((v) => v.formData.description)).toEqual([
        revised.description,
        initialApplication.description,
      ]);
      expect(s.events).toHaveLength(9);
      expect(await createPagesClient(storage).request('/api/demo')).toEqual(s);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });

  it('guards transitions and locked versions, and rejects a forged role in the body', async () => {
    const { post, move, role, get } = setup();
    await expect(move('approved', { role: 'admin' })).rejects.toThrow(
      'INVALID_TRANSITION',
    );
    await move('submitted');
    await expect(move('submitted')).rejects.toThrow('INVALID_TRANSITION');
    expect((await get()).events).toHaveLength(2);
    await expect(
      post('/api/case', { action: 'save', application: initialApplication }),
    ).rejects.toThrow('CASE_NOT_EDITABLE');
    await expect(move('under_review', { role: 'admin' })).rejects.toThrow(
      'INVALID_TRANSITION',
    );
    await role('admin');
    await move('under_review');
    await move('returned', { metadata: { reason: '补充说明' } });
    await role('student');
    await expect(move('draft')).rejects.toThrow('REVISION_REQUIRED');
    expect((await get()).versions).toHaveLength(1);
  });

  it('rechecks business rules at submission and keeps failed requests out of history', async () => {
    const { post, move, get } = setup();
    await post('/api/case', {
      action: 'save',
      application: { ...initialApplication, attendees: 800 },
    });
    await expect(move('submitted')).rejects.toThrow('规则预检未通过');
    expect((await get()).case.status).toBe('draft');
    expect((await get()).events).toHaveLength(1);
  });

  for (const path of ['form-assist', 'review-brief', 'return-message']) {
    it(`validates Mock outputs and all three faults for ${path}`, async () => {
      const { post, get } = setup();
      for (const [faultMode, errorCode] of [
        ['none', null],
        ['invalid_json', 'INVALID_JSON'],
        ['rule_999', 'RULE_NOT_FOUND'],
        ['timeout', 'MODEL_TIMEOUT'],
      ] as const) {
        const result = await post<AgentResult<unknown>>(`/api/agent/${path}`, {
          application: initialApplication,
          faultMode,
        });
        expect(result.ok).toBe(errorCode === null);
        if (!result.ok) expect(result.errorCode).toBe(errorCode);
        expect(result.mode).toBe('mock');
      }
      const s = await get();
      expect(s.aiRuns).toHaveLength(4);
      expect(
        s.aiRuns.filter((r) => r.validationStatus === 'rejected'),
      ).toHaveLength(3);
      expect(s.aiRuns[0].latencyMs).toBeGreaterThanOrEqual(550);
      expect(s.case.status).toBe('draft');
      expect(s.application).toEqual(initialApplication);
    });
  }

  it('isolates visitors and resets the role, history and persisted snapshot', async () => {
    const a = setup();
    const b = setup();
    await a.move('submitted');
    await a.role('admin');
    expect((await b.get()).case.status).toBe('draft');
    await a.post('/api/demo/reset');
    expect(await a.client.request('/api/demo/role')).toEqual({
      role: 'student',
    });
    const s = await a.get();
    expect(s.case.status).toBe('draft');
    expect(s.events).toHaveLength(1);
    expect(s.aiRuns).toHaveLength(0);
    expect(await createPagesClient(a.storage).request('/api/demo')).toEqual(s);
  });

  it('survives corrupt local data and reports disabled persistence', async () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, 'broken JSON');
    expect((await setup(storage).get()).case.status).toBe('draft');
    const blocked = createPagesClient({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(
      (await blocked.request<DemoSnapshot>('/api/demo')).demoPersistence,
    ).toBe('memory');
  });

  it('does not append a pending timeout run after a reset', async () => {
    const { post, get } = setup();
    const pending = post('/api/agent/form-assist', {
      application: initialApplication,
      faultMode: 'timeout',
    });
    await post('/api/demo/reset');
    await pending;
    expect((await get()).aiRuns).toHaveLength(0);
  });
});
