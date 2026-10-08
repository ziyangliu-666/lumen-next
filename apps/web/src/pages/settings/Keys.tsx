import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { request, RequestFailure } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';

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
    <Card>
      <CardHeader>
        <CardTitle>OpenAI API key</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <p className="text-muted-foreground">
          Your key is encrypted and never shown again. Only your account can use it. Calls use
          OpenAI’s gpt-4.1-nano model.
        </p>
        <p className="text-muted-foreground">
          OpenAI bills your own account for these calls. Lumen still records their estimated cost in
          Wallet and applies your Lumen spending cap. Your key does not bypass approval.
        </p>
        {state === 'loading' ? <p role="status">Loading key status…</p> : null}
        {state === 'disabled' ? (
          <p role="status">Personal keys are not enabled on this server.</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-gap">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-keep">
            {notice}
          </p>
        ) : null}
        {state === 'ready' ? (
          <>
            <p>
              {metadata
                ? `Key saved · updated ${new Date(metadata.updatedAt).toLocaleString()}`
                : 'No saved key. Calls use the platform model when available.'}
            </p>
            <form onSubmit={submit} className="grid gap-3" aria-busy={pending}>
              <Label htmlFor="openai-key">
                {metadata ? 'Replacement OpenAI key' : 'OpenAI key'}
              </Label>
              <Input
                id="openai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={pending}
                maxLength={16384}
                required
              />
              <Button type="submit" disabled={pending || !value.trim()}>
                {pending ? 'Please wait…' : metadata ? 'Replace key' : 'Save key'}
              </Button>
            </form>
            {metadata ? (
              confirm ? (
                <div className="grid gap-2 rounded-md border p-3">
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
                <Button variant="outline" disabled={pending} onClick={() => setConfirm(true)}>
                  Remove saved key
                </Button>
              )
            ) : null}
          </>
        ) : null}
        <Button
          variant="ghost"
          disabled={pending || state === 'loading'}
          onClick={() => {
            setError('');
            setValue('');
            setConfirm(false);
            setState('loading');
            setRevision((n) => n + 1);
          }}
        >
          Refresh status
        </Button>
        <p className="text-muted-foreground">
          A rejected or unreadable saved key stops the call; it does not silently switch to a
          platform key. Deleting your account removes its saved key.
        </p>
      </CardContent>
    </Card>
  );
}
