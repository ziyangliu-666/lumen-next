import * as React from 'react';
import { cn } from '@/lib/utils';

// The one input field of the product: the question on the landing, a new
// project on home, a reply on session. Every page uses this one, so the act
// of asking lumen something looks and behaves the same everywhere.
//
// It is drawn as a message box, the way chat products draw theirs: the text
// on top, two lines high, and a row at the foot of the box with Attach and
// the modes on the left and the send square on the right. A one-line field
// with a black block beside it read as a form, not as a place to write to
// lumen. Attached files show as chips inside the box, above the text.
// Send is dimmed until there is something to send.
//
// The hint under the box is for status only: an upload in progress, a
// connection that is down, an error. It does not explain the field.
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
  /** Files that go with the next message, drawn as chips in the box. */
  attachments?: readonly string[];
  onRemoveAttachment?: (name: string) => void;
  /** Lets an empty field be sent; otherwise send waits for text. */
  allowEmpty?: boolean;
  /** More controls in the row at the foot of the box, after Attach (a model picker). */
  toolbar?: React.ReactNode;
  /**
   * Given while something runs: with nothing typed, the send square stops
   * it, as chat products do. Typing turns it back into send.
   */
  onStop?: () => void;
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

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path
        d="M10 3a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 10 3zM5 9.5a5 5 0 0 0 10 0M10 14.5V17"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Dictation through the browser's own speech recognition (Chrome, Edge,
// Safari). The type is declared here: TypeScript's DOM library does not
// carry it. Where the browser has none, the field shows no microphone.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speech to text into the field. The words are added to what is there and
 * nothing is sent: the person reads them and sends.
 */
function useDictation(value: string, onValueChange: (value: string) => void) {
  const [listening, setListening] = React.useState(false);
  const live = React.useRef<Recognition | null>(null);
  const latest = React.useRef(value);
  latest.current = value;
  const Class = React.useMemo(recognitionClass, []);
  React.useEffect(() => () => live.current?.stop(), []);
  if (!Class) return null;
  const toggle = (): void => {
    if (live.current) {
      live.current.stop();
      return;
    }
    const recognition = new Class();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    const before = latest.current;
    recognition.onresult = (event) => {
      const said = Array.from(event.results, (result) => result[0]?.transcript ?? '').join(' ');
      onValueChange(`${before}${before && !/\s$/.test(before) ? ' ' : ''}${said.trim()}`);
    };
    recognition.onend = () => {
      live.current = null;
      setListening(false);
    };
    recognition.onerror = recognition.onend;
    live.current = recognition;
    setListening(true);
    recognition.start();
  };
  return { listening, toggle };
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" stroke="currentColor" strokeWidth="2" fill="none" />
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
  attachments = [],
  onRemoveAttachment,
  allowEmpty = false,
  toolbar,
  onStop,
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
  const empty = !allowEmpty && value.trim() === '' && attachments.length === 0;
  const dictation = useDictation(value, onValueChange);
  const cannotSend = disabled || sendDisabled || empty;

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!cannotSend) form.current?.requestSubmit();
  }

  return (
    <form
      ref={form}
      data-slot="composer"
      className={cn('min-w-0', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (cannotSend) return;
        onSubmit(event);
      }}
    >
      <div
        className="relative border border-ink bg-paper has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:-outline-offset-1 has-[textarea:focus-visible]:outline-ink"
        // The whole box is the field: a click on its empty part puts the caret in the text.
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            document.getElementById(fieldId)?.focus();
          }
        }}
      >
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        {attachments.length > 0 ? (
          <ul aria-label="Attached" className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((file) => (
              <li
                key={file}
                className="flex items-center gap-1 border border-rule-minor bg-well py-0.5 pr-1 pl-2 font-mono text-xs text-ink"
              >
                <AttachIcon />
                <span className="max-w-[24ch] truncate">{file}</span>
                {onRemoveAttachment ? (
                  <button
                    type="button"
                    aria-label={`Remove ${file}`}
                    onClick={() => onRemoveAttachment(file)}
                    className="grid size-5 place-items-center text-ink-2 hover:text-ink"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          id={fieldId}
          name={name}
          rows={2}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the page decides; the landing's only task is this field
          autoFocus={autoFocus}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="block field-sizing-content max-h-[40svh] min-h-16 w-full resize-none overflow-y-auto border-0 bg-transparent px-4 pt-3 pb-1 text-base outline-none placeholder:text-ink-3 placeholder:opacity-100 focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex min-h-11 items-center gap-3 pr-1.5 pb-1.5 pl-2">
          {onAttach ? (
            <>
              <button
                type="button"
                aria-label="Attach a file"
                disabled={disabled}
                onClick={() => picker.current?.click()}
                className="flex h-8 shrink-0 items-center gap-1 px-2 text-sm text-ink-2 hover:bg-well hover:text-ink disabled:opacity-50"
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
          {toolbar}
          {modes && modes.length > 0 ? (
            <div
              role="group"
              {...(modesLabelVisible
                ? { 'aria-labelledby': `${fieldId}-modes` }
                : { 'aria-label': modesLabel })}
              className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
            >
              {modesLabelVisible ? (
                <span id={`${fieldId}-modes`} className="text-xs text-ink-2">
                  {modesLabel}
                </span>
              ) : null}
              <span className="flex">
                {modes.map((item, index) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={item.value === mode}
                    disabled={disabled || modesDisabled}
                    onClick={() => onModeChange?.(item.value)}
                    className={cn(
                      'h-7 border border-ink px-2 text-xs font-medium disabled:opacity-50',
                      index > 0 && '-ml-px',
                      item.value === mode ? 'bg-ink text-paper' : 'text-ink hover:bg-well',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            </div>
          ) : null}
          <span className="ml-auto flex items-center gap-1">
            {dictation ? (
              <button
                type="button"
                aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
                aria-pressed={dictation.listening}
                disabled={disabled}
                onClick={dictation.toggle}
                className={cn(
                  'grid size-8 shrink-0 place-items-center hover:bg-well disabled:opacity-50',
                  dictation.listening ? 'bg-well text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                <MicIcon />
              </button>
            ) : null}
            {onStop && empty ? (
              <button
                type="button"
                aria-label="Stop"
                disabled={disabled}
                onClick={onStop}
                className="grid size-8 shrink-0 place-items-center bg-ink text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-25"
              >
                <span aria-hidden="true" className="size-3 bg-paper" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label={sendLabel}
                disabled={cannotSend}
                className="grid size-8 shrink-0 place-items-center bg-ink text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-25"
              >
                <SendIcon />
              </button>
            )}
          </span>
        </div>
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
