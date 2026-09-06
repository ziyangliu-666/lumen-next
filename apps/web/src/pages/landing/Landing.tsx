// Owner: PENG XUJIAN. Page: Landing.
import type { JSX } from 'react';
import { Button } from '@/ui/button';

export function Landing(): JSX.Element {
  return (
    <section className="mx-auto max-w-2xl py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">
        Watch your agents think together
      </h1>
      <p className="mt-4 text-muted-foreground">
        Agents delegate to agents. lumen draws the call graph, prices every step, and lets you
        interrupt a run while it is still running.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild size="lg">
          <a href="#/signin">Start a session</a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href="#/home">See a run</a>
        </Button>
      </div>
    </section>
  );
}
