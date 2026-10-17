import { useState, type JSX } from 'react';
import { ModelPicker, useModels } from '@/core/models';

/** The upload route's limit, said before sending rather than by the server. */
const ATTACH_LIMIT = 10 * 1024 * 1024;
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
  // Files picked before the project exists, sent once it is created.
  const [files, setFiles] = useState<readonly File[]>([]);
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const models = useModels(true);
  const [model, setModel] = useState<string | undefined>(undefined);
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
          void submit(files, model);
        }}
        onAttach={(file) => {
          if (file.size > ATTACH_LIMIT) {
            setTooLarge(file.name);
            return;
          }
          setTooLarge(null);
          setFiles((list) => [...list.filter((kept) => kept.name !== file.name), file]);
        }}
        attachments={files.map((file) => file.name)}
        onRemoveAttachment={(name) => setFiles((list) => list.filter((file) => file.name !== name))}
        toolbar={<ModelPicker models={models} value={model} onChange={setModel} />}
        placeholder={PROJECT_PLACEHOLDER}
        hint={
          tooLarge
            ? `${tooLarge} is larger than 10 MB, the most one file can be.`
            : pending
              ? 'Starting…'
              : ''
        }
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
