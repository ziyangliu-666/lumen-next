import { describe, expect, it } from 'vitest';
import { states } from './index.js';

describe('projects: State', () => {
  it('running goes to waiting when it needs the user, and stops being live', () => {
    const next = states.running.onEvent('needs-user');
    expect(next.name).toBe('waiting');
    expect(next.live).toBe(false);
  });

  it('a finished project ignores every event', () => {
    expect(states.finished.onEvent('resumed').name).toBe('finished');
    expect(states.finished.onEvent('stop').name).toBe('finished');
  });

  it('waiting resumes to running', () => {
    expect(states.waiting.onEvent('resumed').name).toBe('running');
  });

  it.todo('the project card subscribes to state.live to decide whether to poll');
});
