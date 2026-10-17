import * as React from 'react';
import { cn } from '@/lib/utils';

// The one input field of the product: the question on the landing, a new
// project on home, a reply on session. Every page uses this one, so the act
// of asking lumen something looks and behaves the same everywhere.
//
// Parts, top to bottom:
// - Modes (optional): 14px tabs, one pressed. They change what the text
//   means, so they sit above the field they qualify.
// - The field: one ink box. The text grows with its content. Attach and the
//   send square fill the box's height and meet its edge, so the field reads
//   as one control, not a box with boxes inside.
// - The hint: one line that says what happens when you send.
//
// Enter sends and Shift+Enter breaks the line. Enter never sends while an
// input method is composing (Chinese, Japanese), because there Enter picks a
// candidate.

interface ComposerMode {
  readonly value: string;
  readonly label: string;
}

interface ComposerProps {
  /** The text. The composer is controlled: the page owns the draft. */
  value: string;
  onValueChange: (value: string) => void;
  /** Called with the form event already prevented. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** What a screen reader calls the field, for example "Reply to lumen". */
  label: string;
  placeholder?: string;
  /** The line under the field. `hintTone="ask"` prints it in ink, to ask for something. */
  hint?: React.ReactNode;
  hintTone?: 'quiet' | 'ask';
  /** Modes above the field. Leave out for a plain field. */
  modes?: readonly ComposerMode[];
  mode?: string;
  onModeChange?: (value: string) => void;
  /** What a screen reader calls the group of modes, for example "When it lands". */
  modesLabel?: string;
  /**
   * Prints `modesLabel` before the modes. Use it when the modes are a choice
   * about the message and not about the content: two bare words such as "At
   * its next step" read as content tabs.
   */
  modesLabelVisible?: boolean;
  /**
   * Locks the modes and leaves the field typeable. Use it when the choice
   * cannot be honoured right now (the connection is down) but a draft can
   * still be written.
   */
  modesDisabled?: boolean;
  /** Shows Attach when given; called with the file the person picked. */
  onAttach?: (file: File) => void;
  accept?: string;
  /** The send square's accessible name. */
  sendLabel?: string;
  /** Disables sending, not typing: a draft can still be written. */
  sendDisabled?: boolean;
  disabled?: boolean;
  maxLength?: number;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  className?: string;
  /** Extra form content, for example a hidden input. */
  children?: React.ReactNode;
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <path
        d="M3 10h13M10.5 4.5 16 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

function Composer({
  value,
  onValueChange,
  onSubmit,
  label,
  placeholder,
  hint,
  hintTone = 'quiet',
  modes,
  mode,
  onModeChange,
  modesLabel = 'Mode',
  modesLabelVisible = false,
  modesDisabled = false,
  onAttach,
  accept,
  sendLabel = 'Send',
  sendDisabled = false,
  disabled = false,
  maxLength,
  id,
  name,
  autoFocus,
  className,
  children,
}: ComposerProps) {
  const autoId = React.useId();
  const fieldId = id ?? `composer-${autoId}`;
  const hintId = `${fieldId}-hint`;
  const form = React.useRef<HTMLFormElement | null>(null);
  const picker = React.useRef<HTMLInputElement | null>(null);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!sendDisabled && !disabled) form.current?.requestSubmit();
  }

  return (
    <form
      ref={form}
      data-slot="composer"
      className={cn('min-w-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (sendDisabled || disabled) return;
        onSubmit(event);
      }}
    >
      {modes && modes.length > 0 ? (
        <div
          role="group"
          {...(modesLabelVisible
            ? { 'aria-labelledby': `${fieldId}-modes` }
            : { 'aria-label': modesLabel })}
          className={cn(
            'mb-2 flex flex-wrap items-baseline',
            modesLabelVisible ? 'items-center gap-x-3 gap-y-1' : 'gap-x-6',
          )}
        >
          {modesLabelVisible ? (
            <span id={`${fieldId}-modes`} className="text-caption text-ink-2">
              {modesLabel}
            </span>
          ) : null}
          {/* A choice about the message (when it lands) is a segmented pair
              of small boxes, so it does not look like the content tabs on
              the landing and home (what kind of project), which are words
              with a rule under them. The two looked identical before. */}
          <span className={modesLabelVisible ? 'flex' : 'flex flex-wrap gap-x-6'}>
            {modes.map((item, index) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={item.value === mode}
                disabled={disabled || modesDisabled}
                onClick={() => onModeChange?.(item.value)}
                className={cn(
                  'text-sm font-medium disabled:opacity-50',
                  modesLabelVisible
                    ? cn(
                        'h-7 border border-ink px-2 text-xs',
                        index > 0 && '-ml-px',
                        item.value === mode ? 'bg-ink text-paper' : 'text-ink hover:bg-well',
                      )
                    : cn(
                        'border-b-2 py-1',
                        item.value === mode
                          ? 'border-ink text-ink'
                          : 'border-transparent text-ink-2 hover:text-ink',
                      ),
                )}
              >
                {item.label}
              </button>
            ))}
          </span>
        </div>
      ) : null}
      <div className="relative flex items-stretch border border-ink bg-paper pl-4 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:-outline-offset-1 has-[textarea:focus-visible]:outline-ink">
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        <textarea
          id={fieldId}
          name={name}
          rows={1}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page decides; the landing's only task is this field
          autoFocus={autoFocus}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="block field-sizing-content max-h-[40svh] min-h-12 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-3 text-base outline-none placeholder:text-ink-3 placeholder:opacity-100 focus-visible:outline-none disabled:opacity-50"
        />
        {onAttach ? (
          <>
            <button
              type="button"
              aria-label="Attach a file"
              disabled={disabled}
              onClick={() => picker.current?.click()}
              className="flex shrink-0 items-center gap-1 px-2 text-sm font-medium text-ink-2 hover:bg-well hover:text-ink roomy:px-4"
            >
              <AttachIcon />
              <span className="sr-only roomy:not-sr-only">Attach</span>
            </button>
            <input
              ref={picker}
              type="file"
              hidden
              accept={accept}
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAttach(file);
                event.target.value = '';
              }}
            />
          </>
        ) : null}
        <button
          type="submit"
          aria-label={sendLabel}
          disabled={disabled || sendDisabled}
          className="grid w-12 shrink-0 place-items-center bg-ink text-paper focus-visible:-outline-offset-4 focus-visible:outline-paper disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </div>
      {hint ? (
        <p
          id={hintId}
          aria-live="polite"
          className={cn('mt-2 text-caption', hintTone === 'ask' ? 'text-ink' : 'text-ink-2')}
        >
          {hint}
        </p>
      ) : null}
      {children}
    </form>
  );
}

export { Composer, type ComposerMode, type ComposerProps };
