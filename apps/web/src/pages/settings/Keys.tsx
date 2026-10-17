import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { Alert } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Section } from '@/ui/section';

interface Metadata {
  provider: 'openai';
  updatedAt: string;
}
export function Keys(): JSX.Element {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading');
  const [revision, setRevision] = useState(0);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void request<{ keys: Metadata[] }>('/api/keys', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((body) => {
        if (!controller.signal.aborted) {
          setMetadata(body.keys.find((key) => key.provider === 'openai') ?? null);
          setState('ready');
        }
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        if (failure instanceof RequestFailure && failure.status === 404) setState('disabled');
        else {
          setState('error');
          setError(
            failure instanceof RequestFailure && failure.status === 401
              ? 'Sign in again to manage your key.'
              : 'Could not load your key status. Please retry.',
          );
        }
      });
    return () => controller.abort();
  }, [revision]);
  async function mutate(method: 'PUT' | 'DELETE'): Promise<void> {
    if (busy.current) return;
    if (method === 'PUT' && (!value.trim() || new TextEncoder().encode(value).length > 16384)) {
      setError('Enter a key of at most 16 KiB.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    const submitted = value;
    setValue('');
    try {
      await request<void>('/api/keys/openai', {
        method,
        ...(method === 'PUT' ? { json: { value: submitted } } : {}),
        cache: 'no-store',
      });
      setNotice(
        method === 'PUT'
          ? 'Key saved. It will be used on the next model call.'
          : 'Key removed. Future calls use the platform model when available.',
      );
      setConfirm(false);
      setState('loading');
      setRevision((n) => n + 1);
    } catch {
      setError('The change could not be confirmed. Refresh the status before retrying.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    void mutate('PUT');
  }
  return (
    // Refresh sits at the section's head, as on the other tabs, in the
    // same outlined button: it was the one bold text link among them.
    <Section
      title="OpenAI API key"
      // No Refresh when the server has no key store: there is nothing it
      // could load.
      actions={
        state === 'disabled' ? undefined : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending || state === 'loading'}
            onClick={() => {
              setError('');
              setValue('');
              setConfirm(false);
              setState('loading');
              setRevision((n) => n + 1);
            }}
          >
            Refresh
          </Button>
        )
      }
    >
      <div className="grid gap-4 text-sm">
        <p className="text-ink-2">
          Your key is encrypted and never shown again. Only your account can use it. Calls use
          OpenAI’s gpt-4.1-nano model.
        </p>
        <p className="text-ink-2">
          OpenAI bills your own account for these calls. lumen still records their estimated cost in
          Wallet and applies your lumen spending cap. Your key does not bypass approval.
        </p>
        {state === 'loading' ? (
          <p role="status" className="text-ink-2">
            Loading key status…
          </p>
        ) : null}
        {state === 'disabled' ? (
          <Alert role="status" title="Personal keys are not available on this server">
            This server has no key store. Calls use the platform model when available.
          </Alert>
        ) : null}
        {error ? <Alert title="Your key status is not known">{error}</Alert> : null}
        {notice ? (
          <p role="status" className="text-ink">
            {notice}
          </p>
        ) : null}
        {state === 'ready' ? (
          <>
            <p className="text-ink">
              {metadata ? (
                <>
                  Key saved. Updated{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(metadata.updatedAt).toLocaleString()}
                  </span>
                  .
                </>
              ) : (
                'No saved key. Calls use the platform model when available.'
              )}
            </p>
            <form onSubmit={submit} className="grid max-w-md gap-2" aria-busy={pending}>
              <Label htmlFor="openai-key">
                {metadata ? 'Replacement OpenAI key' : 'OpenAI key'}
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="openai-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={pending}
                  maxLength={16384}
                  className="min-w-0 flex-1 font-mono"
                  required
                />
                <Button type="submit" disabled={pending || !value.trim()}>
                  {pending ? 'Please wait…' : metadata ? 'Replace key' : 'Save key'}
                </Button>
              </div>
            </form>
            {metadata ? (
              confirm ? (
                <div className="grid max-w-md gap-3 border border-ink p-4">
                  <p>Remove your saved key? Calls already sent to OpenAI are not cancelled.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        void mutate('DELETE');
                      }}
                    >
                      Confirm removal
                    </Button>
                    <Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button variant="outline" disabled={pending} onClick={() => setConfirm(true)}>
                    Remove saved key
                  </Button>
                </div>
              )
            ) : null}
          </>
        ) : null}
        <p className="border-t border-rule-minor pt-4 text-ink-2">
          A rejected or unreadable saved key stops the call; it does not silently switch to a
          platform key. Deleting your account removes its saved key.
        </p>
      </div>
    </Section>
  );
}
