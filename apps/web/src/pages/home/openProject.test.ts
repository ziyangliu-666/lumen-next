import { describe, expect, it, vi } from 'vitest';
import { request } from '@/core/api';
import { openProject } from './openProject';
vi.mock('@/core/api', () => ({ request: vi.fn() }));
describe('opening a project', () => {
  it('records the visit before navigating and does not navigate on failure', async () => {
    const navigate = vi.fn();
    let resolve!: () => void;
    vi.mocked(request).mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const opening = openProject('project id', '/target', navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith('/api/projects/project%20id/visit', { method: 'POST' });
    resolve();
    await opening;
    expect(navigate).toHaveBeenCalledWith('/target');
    navigate.mockClear();
    vi.mocked(request).mockRejectedValueOnce(new Error('offline'));
    await expect(openProject('id', '/target', navigate)).rejects.toThrow('offline');
    expect(navigate).not.toHaveBeenCalled();
  });
});
