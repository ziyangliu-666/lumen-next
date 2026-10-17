// Owner: PENG XUJIAN. Page: Landing.
import { useState, type JSX, type ReactNode } from 'react';
import { useCurrentAccount } from '@/core/auth';
import { DevelopmentSignIn } from '@/core/devSignIn';
import { PROJECT_PLACEHOLDER, saveProjectDraft, useNewProject } from '@/core/newProject';
import { Composer } from '@/ui/composer';
import { Bleed } from '@/ui/surfaces';
import { greeting, RecentProjects, Starters, useRecent } from './starts';

/** The upload route's limit, said before sending rather than by the server. */
const ATTACH_LIMIT = 10 * 1024 * 1024;

// The front page: one screen and one object. The halftone sphere on the
// right is the image, and the cursor turns the camera round it. The text
// column on the left takes the first question, so a visitor can start before
// they have an account; the draft waits in this tab while they sign in.
// Signed in, it greets the person, takes attachments, and lists their recent
// projects under the field, or starter questions when they have none.

const SIGN_IN_FIRST = 'Sign in to start.';

export function Landing(): JSX.Element {
  // Who is signed in is the shell's answer, not this page's: real sign-in and
  // the development account both arrive through the same hook.
  const { state: auth, refresh: refreshAccount } = useCurrentAccount();
  const { draft, setQuestion, pending, uncertain, error, clearError, submit } = useNewProject({
    notReady: auth.status === 'ready' ? null : SIGN_IN_FIRST,
    onUnauthorized: refreshAccount,
  });
  const signedOut = auth.status === 'signed-out';
  const signedIn = auth.status === 'ready';
  const recent = useRecent(signedIn);
  // Files picked before the project exists: kept here, sent after it is
  // created (useNewProject). Chips in the field show them.
  const [files, setFiles] = useState<readonly File[]>([]);
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  // The line under the field is for a problem only, printed in ink because it
  // asks the person to act; red stays for work that waits on them in a run.
  let hint: ReactNode;
  let asks = false;
  if (tooLarge) {
    asks = true;
    hint = `${tooLarge} is larger than 10 MB, the most one file can be.`;
  } else if (pending) {
    hint = 'Starting…';
  } else if (error || uncertain) {
    asks = true;
    hint = (
      <>
        {error === SIGN_IN_FIRST && signedOut ? (
          // The question waits in this tab while they sign in.
          <>
            <a href="#/signin" onClick={() => saveProjectDraft(draft)} className="underline">
              Sign in
            </a>{' '}
            to start.
          </>
        ) : (
          error
        )}
        {error && uncertain ? ' ' : null}
        {uncertain ? (
          <>
            This may have started. Check{' '}
            <a href="#/home" className="underline">
              Projects
            </a>{' '}
            before you send again.
          </>
        ) : null}
      </>
    );
  } else {
    hint = '';
  }

  return (
    <Bleed>
      {/* The scene runs behind the whole page, so its particles cross the
          text. A scrim of paper behind the text column, fading to clear
          toward the sphere, keeps the words on a quiet ground and leaves the
          sky open on the right. Narrow, the text sits under the sphere, so
          the scrim rises from the foot instead. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-[5] bg-linear-to-t from-paper from-35% via-paper/70 via-55% to-transparent to-75% roomy:bg-linear-to-r roomy:from-paper roomy:from-30% roomy:via-paper/75 roomy:via-45% roomy:to-transparent roomy:to-62%"
      />
      {/* The sphere is the shell's scene (ui/space), in its landing shot: on
          the right over 720px, above the text under it. The hero hangs from
          a fixed top, not from the centre: centred, it moved up 50px under
          the cursor when Developer sign-in opened. Narrow, the top clears
          the sphere: the shot centres it at 20% of the screen height with a
          radius of 13%, and the camera's drift swells that to about 17%, so
          the text starts at 38%. */}
      <div className="grid min-h-0 flex-1 grid-cols-12 content-start gap-x-gutter overflow-y-auto px-margin pt-[calc(38svh-var(--bar-h))] pb-6 roomy:pt-[max(2.5rem,calc(50svh-17rem))] roomy:pb-10">
        <div className="col-span-12 roomy:col-span-6 split:col-span-5">
          <h1 className="text-[clamp(2.25rem,3.9vw,3.5rem)] leading-[1.02] font-medium tracking-[-0.035em] text-ink">
            {/* Signed in, the page greets the person, as chat products do;
                the promise is for a first visit. */}
            {auth.status === 'ready' ? (
              <span className="block">{greeting(auth.account.displayName)}</span>
            ) : (
              <>
                <span className="block">Now you can do any frontier work.</span>
                <span className="block text-ink-2">Just start.</span>
              </>
            )}
          </h1>
          <Composer
            className="mt-6 roomy:mt-10"
            id="research-question"
            label="What should lumen look into?"
            value={draft.question}
            onValueChange={setQuestion}
            onSubmit={() => {
              void submit(files);
            }}
            // Signed out, a file could not wait in the tab through sign-in
            // the way the question does, so Attach comes with an account.
            {...(signedIn
              ? {
                  onAttach: (file: File) => {
                    if (file.size > ATTACH_LIMIT) {
                      setTooLarge(file.name);
                      return;
                    }
                    setTooLarge(null);
                    setFiles((list) => [...list.filter((kept) => kept.name !== file.name), file]);
                  },
                  attachments: files.map((file) => file.name),
                  onRemoveAttachment: (name: string) =>
                    setFiles((list) => list.filter((file) => file.name !== name)),
                }
              : {})}
            placeholder={PROJECT_PLACEHOLDER}
            hint={hint}
            hintTone={asks ? 'ask' : 'quiet'}
            sendLabel="Start"
            sendDisabled={pending || uncertain}
            disabled={pending}
          />
          {/* Recents when there are some, starter questions when there are
              none. A starter fills the field; the person sends it. */}
          <div className="mt-6 roomy:mt-8">
            {recent && recent.length > 0 ? (
              <RecentProjects items={recent} />
            ) : signedIn && recent === null ? null : (
              <Starters
                onPick={(question) => {
                  setQuestion(question);
                  document.getElementById('research-question')?.focus();
                }}
              />
            )}
          </div>
          {signedOut && auth.mode === 'stub' ? (
            // Development only: the stub account stands in for sign-in. It
            // is folded under the field, small and grey, because the field
            // is the page: open, the form had the same weight as the
            // question and read as a second way to start.
            <details className="group mt-4 text-caption text-ink-2">
              <summary className="cursor-pointer list-none font-medium hover:text-ink [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="mr-1 inline-block group-open:rotate-90">
                  ›
                </span>
                Developer sign-in
              </summary>
              <DevelopmentSignIn
                className="mt-3"
                onSignedIn={() => {
                  clearError();
                }}
              />
            </details>
          ) : null}
        </div>
      </div>
    </Bleed>
  );
}
