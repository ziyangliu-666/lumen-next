// Owner: PENG XUJIAN. Page: Landing.
import { useState, type FormEvent, type JSX } from 'react';
import { signInStub, stubAccount } from '@/core/api';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Textarea } from '@/ui/textarea';

const DRAFT = 'lumen.projects.draft';
interface Draft {
  question: string;
  mode: 'explore' | 'seed';
}
function readDraft(): Draft {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(DRAFT) ?? 'null');
    if (
      raw &&
      typeof raw === 'object' &&
      'question' in raw &&
      typeof raw.question === 'string' &&
      'mode' in raw &&
      (raw.mode === 'explore' || raw.mode === 'seed')
    )
      return { question: raw.question, mode: raw.mode };
  } catch {
    /* Storage may be disabled; the form still works in memory. */
  }
  return { question: '', mode: 'explore' };
}
function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT, JSON.stringify(draft));
  } catch {
    /* Keep the in-memory input. */
  }
}
export function Landing(): JSX.Element {
  const [draft, setDraft] = useState(readDraft);
  const [account, setAccount] = useState(() => stubAccount() ?? '');
  const [accountInput, setAccountInput] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function update(next: Draft): void {
    setDraft(next);
    saveDraft(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending || uncertain) return;
    const question = draft.question.trim();
    if (!question || [...question].length > 10000) {
      setError('Enter a question of 1 to 10,000 characters.');
      return;
    }
    if (!account) {
      setError('Sign in before starting. Your question is saved in this tab.');
      return;
    }
    saveDraft(draft);
    setPending(true);
    setError(null);
    try {
      // Local bridge until the shared client gains the projects methods (see wiring patch).
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, mode: draft.mode }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setAccount('');
          throw new Error('Please sign in again. Your question has been kept.');
        }
        if (response.status >= 500) setUncertain(true);
        const body: unknown = await response.json();
        throw new Error(
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Could not start the project.',
        );
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('sessionId' in result) ||
        typeof result.sessionId !== 'string'
      ) {
        setUncertain(true);
        throw new Error('Creation response was incomplete. Check Projects before trying again.');
      }
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {
        /* Navigation still works. */
      }
      window.location.assign(`?session=${encodeURIComponent(result.sessionId)}#/session`);
    } catch (failure: unknown) {
      if (failure instanceof TypeError || failure instanceof SyntaxError) setUncertain(true);
      setError(failure instanceof Error ? failure.message : 'Could not start the project.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mx-auto max-w-2xl space-y-8 py-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">A question worth exploring</p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink">Start with curiosity.</h1>
        <p className="text-muted-foreground">
          Give your agents a research question. Follow their work, guide the next step, and return
          to the findings they keep.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Start a research project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="space-y-6"
            aria-busy={pending}
          >
            <div className="space-y-2">
              <Label htmlFor="research-question">Research question</Label>
              <Textarea
                id="research-question"
                placeholder="What would you like to understand?"
                rows={6}
                value={draft.question}
                onChange={(event) => update({ ...draft, question: event.target.value })}
                disabled={pending}
                required
                aria-describedby="question-help"
              />
              <p id="question-help" className="text-sm text-muted-foreground">
                Be specific about your question and any constraints. Up to 10,000 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="research-mode">Research mode</Label>
              <Select
                value={draft.mode}
                onValueChange={(mode: string) => {
                  if (mode === 'explore' || mode === 'seed') update({ ...draft, mode });
                }}
                disabled={pending}
              >
                <SelectTrigger id="research-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="explore">Explore</SelectItem>
                  <SelectItem value="seed">Seed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Explore a question broadly, or start from a concrete research idea.
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-gap-soft p-3 text-sm text-gap">
                {error}
              </p>
            )}
            {uncertain && (
              <p className="text-sm text-muted-foreground">
                The request may have reached the server. Check Projects to find the saved project;
                this form will not start a second run automatically.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || uncertain}>
                {pending ? 'Starting…' : 'Start research'}
              </Button>
              <Button asChild variant="outline">
                <a href="#/home">View projects</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {!account ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Continue with your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your draft stays in this tab while you sign in.
            </p>
            <Button asChild variant="outline">
              <a href="#/signin" onClick={() => saveDraft(draft)}>
                Sign in
              </a>
            </Button>
            {window.location.hostname === 'localhost' && (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const id = accountInput.trim();
                  if (id) {
                    signInStub(id);
                    setAccount(id);
                    setError(null);
                  }
                }}
              >
                <Label htmlFor="development-account">Development account</Label>
                <Input
                  id="development-account"
                  value={accountInput}
                  onChange={(event) => setAccountInput(event.target.value)}
                  placeholder="Same account as the Session page"
                  required
                />
                <Button type="submit" variant="secondary">
                  Use development account
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ready to start. Your projects are private to your account.
        </p>
      )}
    </section>
  );
}
