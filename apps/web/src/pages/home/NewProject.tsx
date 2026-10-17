import type { JSX } from 'react';
import { PROJECT_PLACEHOLDER, useNewProject } from '@/core/newProject';
import { Alert } from '@/ui/alert';
import { Composer } from '@/ui/composer';
import { RegionName } from '@/ui/surfaces';

// The new-project form on the well. The field and the flow are the landing's
// (core/newProject), so a question starts the same way from either page, and
// a question typed on the landing before sign-in waits here.

export const NEW_PROJECT_FIELD = 'new-project-question';

/** Puts the cursor in the new-project field; on a narrow screen this also scrolls to it. */
export function focusNewProject(): void {
  document.getElementById(NEW_PROJECT_FIELD)?.focus();
}

export function NewProject({ onUnauthorized }: { onUnauthorized: () => void }): JSX.Element {
  const { draft, setQuestion, pending, uncertain, error, submit } = useNewProject({
    onUnauthorized,
  });
  return (
    <section aria-labelledby="new-project-name" className="pt-4">
      {/* min-h-8: the height of the projects heading row beside it. */}
      <div className="mb-4 flex min-h-8 items-center">
        <RegionName id="new-project-name" className="mb-0">
          New project
        </RegionName>
      </div>
      <Composer
        id={NEW_PROJECT_FIELD}
        label="What should lumen look into?"
        value={draft.question}
        onValueChange={setQuestion}
        onSubmit={() => {
          void submit();
        }}
        placeholder={PROJECT_PLACEHOLDER}
        hint={pending ? 'Starting…' : ''}
        sendLabel="Start the project"
        sendDisabled={pending || uncertain}
      />
      {error && (
        <Alert title="The project was not started" className="mt-3">
          {error}
        </Alert>
      )}
      {uncertain && (
        <p className="mt-2 text-caption text-ink-2">
          This may have started. Find it in the list before you send again.
        </p>
      )}
    </section>
  );
}
