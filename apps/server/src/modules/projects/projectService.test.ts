import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MemoryProjectStore } from './memoryProjectStore.js';
import { ProjectService } from './projectService.js';
import type { LatestSession } from './models.js';
import type { ProjectSessions } from './ports.js';

const owner = { accountId: 'owner', role: 'user' as const };
function setup(): {
  service: ProjectService;
  store: MemoryProjectStore;
  sessions: ProjectSessions;
} {
  const store = new MemoryProjectStore();
  const sessions: ProjectSessions = {
    start: vi.fn().mockResolvedValue({ id: randomUUID() }),
    list: vi.fn().mockResolvedValue([]),
    stop: vi.fn().mockResolvedValue(undefined),
    context: vi.fn().mockResolvedValue(null),
    taskSession: vi.fn().mockResolvedValue(null),
  };
  return { service: new ProjectService(store, sessions), store, sessions };
}
function run(status: LatestSession['status'] = 'running', startedAt = 10): LatestSession {
  return {
    id: randomUUID(),
    mode: 'seed',
    status,
    spend: { dollars: 0.123456 },
    startedAt,
    endedAt: null,
  };
}
describe('ProjectService', () => {
  it('persists owner and mode before starting and preserves the full question', async () => {
    const { service, store, sessions } = setup();
    const question = `  ${'😀'.repeat(121)}\nDetails  `;
    const result = await service.create(owner, { question, mode: 'seed' });
    expect(result.project.title).toBe('😀'.repeat(120));
    expect(await store.get(result.project.id)).toMatchObject({ accountId: 'owner', mode: 'seed' });
    expect(sessions.start).toHaveBeenCalledWith(result.project.id, owner, question.trim(), 'seed');
    expect(result.project).not.toHaveProperty('accountId');
  });
  it.each([
    { question: ' ', mode: 'seed' },
    { question: 'x', mode: 'wrong' },
    { question: 'x', mode: 'seed', accountId: 'victim' },
    { question: '😀'.repeat(10001), mode: 'seed' },
  ])('rejects invalid creation before persistence or execution', async (body) => {
    const { service, store, sessions } = setup();
    await expect(service.create(owner, body)).rejects.toMatchObject({ status: 400 });
    expect(await store.list(owner.accountId, { limit: 20, after: null })).toEqual([]);
    expect(sessions.start).not.toHaveBeenCalled();
  });
  it('retains the project on uncertain start failure without retrying execution', async () => {
    const { service, store, sessions } = setup();
    vi.mocked(sessions.start).mockRejectedValue(new Error('timeout'));
    await expect(
      service.create(owner, { question: 'Research', mode: 'explore' }),
    ).rejects.toMatchObject({ status: 503 });
    const rows = await store.list(owner.accountId, { limit: 20, after: null });
    expect(rows).toHaveLength(1);
    expect(sessions.start).toHaveBeenCalledTimes(1);
    const card = await service.get(owner, rows[0]!.id);
    expect(card).toMatchObject({
      latestSession: null,
      refreshPolicy: 'poll',
      actions: { stopLatestSession: false },
    });
  });
  it('uses the latest session deterministically and does not sum money across sessions', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Research', mode: 'seed' });
    const a = { ...run('running', 20), id: '00000000-0000-4000-8000-000000000001' };
    const b = {
      ...run('ended', 20),
      id: '00000000-0000-4000-8000-000000000002',
      endedAt: Date.now() + 10,
    };
    vi.mocked(sessions.list).mockResolvedValue([b, run('running', 5), a]);
    expect(await service.get(owner, project.id)).toMatchObject({
      latestSession: b,
      label: 'Finished',
      refreshPolicy: 'manual',
      lastActivityAt: b.endedAt,
      actions: { openSession: true, stopLatestSession: false },
    });
  });
  it('selects only the latest session for stop and waits for confirmation', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Research', mode: 'explore' });
    const latest = run('waiting', 20);
    vi.mocked(sessions.list).mockResolvedValue([run(), latest]);
    expect(await service.stop(owner, project.id)).toEqual({
      projectId: project.id,
      sessionId: latest.id,
      outcome: 'stop_requested',
    });
    expect(sessions.stop).toHaveBeenCalledWith(latest.id, owner);
    expect((await service.get(owner, project.id)).latestSession?.status).toBe('waiting');
    vi.mocked(sessions.list).mockResolvedValue([{ ...latest, status: 'ended' }]);
    expect((await service.stop(owner, project.id)).outcome).toBe('already_terminal');
    expect(sessions.stop).toHaveBeenCalledTimes(1);
  });
  it('does not access session data for a foreign owner, including staff', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Private', mode: 'seed' });
    const other = { accountId: 'other', role: 'staff' as const };
    await expect(service.get(other, project.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.stop(other, project.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.findings(other, project.id, {})).rejects.toMatchObject({ status: 404 });
    expect(sessions.list).not.toHaveBeenCalled();
    expect(sessions.stop).not.toHaveBeenCalled();
  });
  it('reports dependency failures instead of fabricating an empty card', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Research', mode: 'seed' });
    vi.mocked(sessions.list).mockRejectedValue(new Error('database unavailable'));
    await expect(service.get(owner, project.id)).rejects.toMatchObject({ status: 503 });
  });
  it('checks project ownership for session creation without a recursive session lookup', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Research', mode: 'seed' });
    expect(await service.requireProject(owner, project.id)).toEqual(project);
    await expect(
      service.requireProject({ ...owner, accountId: 'other' }, project.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(sessions.list).not.toHaveBeenCalled();
    expect(sessions.context).not.toHaveBeenCalled();
  });
  it('validates finding associations and retains results across all project sessions', async () => {
    const { service, sessions } = setup();
    const { project } = await service.create(owner, { question: 'Research', mode: 'seed' });
    const sessionId = randomUUID();
    const taskId = randomUUID();
    vi.mocked(sessions.context).mockResolvedValue({
      projectId: project.id,
      accountId: owner.accountId,
    });
    vi.mocked(sessions.taskSession).mockResolvedValue(randomUUID());
    await expect(service.recordFinding(sessionId, taskId, 'Result')).rejects.toMatchObject({
      status: 400,
    });
    vi.mocked(sessions.taskSession).mockResolvedValue(sessionId);
    const finding = await service.recordFinding(
      sessionId,
      taskId,
      '  <script>untrusted</script>  ',
    );
    expect(finding.text).toBe('<script>untrusted</script>');
    expect(await service.projectOf(sessionId)).toEqual({
      id: project.id,
      accountId: owner.accountId,
    });
    expect(await service.listFindings(sessionId)).toEqual([finding]);
    expect((await service.findings(owner, project.id, {})).items).toEqual([finding]);
    expect((await service.get(owner, project.id)).findingsCount).toBe(1);
  });
  it('rejects mismatched session ownership and unknown sessions', async () => {
    const { service, sessions } = setup();
    await expect(service.projectOf(randomUUID())).rejects.toMatchObject({ status: 404 });
    const { project } = await service.create(owner, { question: 'Research', mode: 'seed' });
    vi.mocked(sessions.context).mockResolvedValue({ projectId: project.id, accountId: 'intruder' });
    await expect(service.projectOf(randomUUID())).rejects.toMatchObject({ status: 404 });
  });
  it('paginates ties without duplicates and binds cursors to their owner and endpoint', async () => {
    const { service, store } = setup();
    for (let i = 1; i <= 3; i++)
      await store.insert({
        id: `00000000-0000-4000-8000-00000000000${i}`,
        accountId: owner.accountId,
        title: 'Research',
        mode: 'seed',
        createdAt: 1,
      });
    const first = await service.list(owner, { limit: '2' });
    const second = await service.list(owner, { limit: '2', cursor: first.nextCursor });
    expect(first.items.map((c) => c.project.id.slice(-1))).toEqual(['3', '2']);
    expect(second.items.map((c) => c.project.id.slice(-1))).toEqual(['1']);
    expect(second.nextCursor).toBeNull();
    await expect(
      service.list({ ...owner, accountId: 'other' }, { cursor: first.nextCursor }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.findings(owner, first.items[0]!.project.id, { cursor: first.nextCursor }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
