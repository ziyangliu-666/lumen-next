import { request } from '@/core/api';

export async function openProject(
  projectId: string,
  target: string,
  navigate: (url: string) => void,
): Promise<void> {
  await request(`/api/projects/${encodeURIComponent(projectId)}/visit`, { method: 'POST' });
  navigate(target);
}
