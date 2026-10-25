import { useState } from 'react';
import { request, RequestFailure } from './api';
import { go } from './router';

// Starting a project: the one flow behind the question field on the landing
// and the new-project field on home. It lives here, and not in either page,
// so a question starts the same way from both, and a fix to the duplicate
// guard below lands in both at once.
//
// The draft sits in sessionStorage under one key. A question typed on the
// landing before sign-in therefore waits on home, in the mode it was written
// in. The key and the mode values are the ones the pages used before the
// redesign, so a saved draft still loads.

const DRAFT = 'lumen.projects.draft';
const LIMIT = 10000;

export type ProjectMode = 'explore' | 'seed';

export interface ProjectDraft {
  readonly question: string;
  readonly mode: ProjectMode;
}

// A question to the person, the way chat products ask. "A question, or
// leave it empty" was an instruction, and it read as a form field. The
// person always asks: free exploration has no control in the page.
export const PROJECT_PLACEHOLDER = 'What should lumen work on?';

export function isProjectMode(value: string): value is ProjectMode {
  return value === 'explore' || value === 'seed';
}

function readDraft(): ProjectDraft {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(DRAFT) ?? 'null');
    if (
      raw &&
      typeof raw === 'object' &&
      'question' in raw &&
      typeof raw.question === 'string' &&
      'mode' in raw &&
      typeof raw.mode === 'string' &&
      isProjectMode(raw.mode)
    )
      return { question: raw.question, mode: raw.mode };
  } catch {
    /* Storage may be disabled; the form still works in memory. */
  }
  return { question: '', mode: 'explore' };
}

/** Keeps the draft in this tab, for example before the page leaves for sign-in. */
export function saveProjectDraft(draft: ProjectDraft): void {
  try {
    sessionStorage.setItem(DRAFT, JSON.stringify(draft));
  } catch {
    /* Keep the in-memory input. */
  }
}

function created(result: unknown): { projectId: string; sessionId: string } | null {
  if (
    !result ||
    typeof result !== 'object' ||
    !('sessionId' in result) ||
    typeof result.sessionId !== 'string' ||
    !('project' in result) ||
    !result.project ||
    typeof result.project !== 'object' ||
    !('id' in result.project) ||
    typeof result.project.id !== 'string'
  )
    return null;
  return { projectId: result.project.id, sessionId: result.sessionId };
}

/** The answer of POST /api/v1/questions: `{sessionId, projectId, agent}`. */
function asked(result: unknown): { projectId: string; sessionId: string } | null {
  if (
    !result ||
    typeof result !== 'object' ||
    !('sessionId' in result) ||
    typeof result.sessionId !== 'string' ||
    !('projectId' in result) ||
    typeof result.projectId !== 'string'
  )
    return null;
  return { projectId: result.projectId, sessionId: result.sessionId };
}

export interface NewProjectOptions {
  /**
   * Set when the person cannot send yet, for example nobody is signed in.
   * The send then stops with this message, after the text itself has passed
   * its checks, so the person fixes the text first.
   */
  readonly notReady?: string | null;
  /** Called on a 401: the page refreshes the shared account. */
  readonly onUnauthorized: () => void;
}

export interface NewProject {
  readonly draft: ProjectDraft;
  readonly setQuestion: (question: string) => void;
  readonly pending: boolean;
  /**
   * The server may have created the project, but the page cannot confirm it.
   * Sending stays off from then on, so a resend never starts a second run.
   */
  readonly uncertain: boolean;
  readonly error: string | null;
  /** Clears a message the person has dealt with, for example after signing in. */
  readonly clearError: () => void;
  /**
   * Starts the project. Files go to its /mnt/upload right after it is
   * created, and the question names them, so lumen looks there.
   */
  readonly submit: (files?: readonly File[], model?: string, agent?: string) => Promise<void>;
}

/** The draft, the checks, and the create, visit and open steps of a new project. */
export function useNewProject({ notReady = null, onUnauthorized }: NewProjectOptions): NewProject {
  const [draft, setDraft] = useState(readDraft);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(next: ProjectDraft): void {
    setDraft(next);
    saveProjectDraft(next);
  }

  async function submit(
    files: readonly File[] = [],
    model?: string,
    agent?: string,
  ): Promise<void> {
    if (pending || uncertain) return;
    // The person asks; the field does not send an empty question.
    const typed = draft.question.trim();
    if (!typed) return;
    const question = files.length
      ? `${typed}\n\nAttached: ${files.map((file) => file.name).join(', ')}`
      : typed;
    const mode: ProjectMode = 'seed';
    if ([...question].length > LIMIT) {
      setError('Keep it to 10,000 characters or fewer.');
      return;
    }
    if (notReady) {
      setError(notReady);
      return;
    }
    saveProjectDraft(draft);
    setPending(true);
    setError(null);
    try {
      // With an agent, the project starts through the public API, the same
      // route the literature watch uses (POST /api/v1/questions): it records
      // which agent leads the session, so the producer's usage counts it.
      const result = agent
        ? asked(await request<unknown>('/api/v1/questions', { json: { question, agent } }))
        : created(
            await request<unknown>('/api/projects', {
              json: { question, mode, ...(model ? { model } : {}) },
            }),
          );
      if (!result) {
        setUncertain(true);
        throw new Error('The server did not confirm the new project. Check Projects first.');
      }
      // Creation has succeeded. A failed visit must not let a resend create a duplicate.
      setUncertain(true);
      // The session has started: the uploads go at once, before the lead's
      // first model call comes back, and one that fails does not stop the
      // others. The session's field can attach it again.
      await Promise.all(
        files.map((file) =>
          request(
            `/api/projects/${encodeURIComponent(result.projectId)}/upload/${encodeURIComponent(file.name)}`,
            { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: file },
          ).catch(() => undefined),
        ),
      );
      await request(`/api/projects/${encodeURIComponent(result.projectId)}/visit`, {
        method: 'POST',
      });
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {
        /* Navigation still works. */
      }
      // Inside this document, so the scene behind the page moves to the
      // session's shot instead of starting again after a reload.
      go(`?session=${encodeURIComponent(result.sessionId)}#/session`);
    } catch (failure: unknown) {
      if (failure instanceof RequestFailure) {
        if (failure.status === 401) onUnauthorized();
        if (failure.status >= 500) setUncertain(true);
      }
      if (failure instanceof TypeError || failure instanceof SyntaxError) setUncertain(true);
      setError(failure instanceof Error ? failure.message : 'Could not start the project.');
    } finally {
      setPending(false);
    }
  }

  return {
    draft,
    setQuestion: (question) => update({ ...draft, question }),
    pending,
    uncertain,
    error,
    clearError: () => setError(null),
    submit,
  };
}
