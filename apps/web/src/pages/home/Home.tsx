// Owner: PENG XUJIAN. Page: Home.
import type { JSX } from 'react';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { PageHeader } from '@/core/shell';

// The four states a project card can be in. The tint comes from the theme, so a
// state means the same colour everywhere it appears.
const TONE = {
  running: 'bg-accent text-accent-foreground',
  waiting: 'bg-decide-soft text-decide',
  finished: 'bg-keep-soft text-keep',
  stopped: 'bg-gap-soft text-gap',
} as const;

export function Home(): JSX.Element {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Owned by PENG XUJIAN. Build this against the @lumen/contracts event stream."
        actions={<Button>New project</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Example project</CardTitle>
            <Badge className={TONE.running}>running</Badge>
          </CardHeader>
          <CardContent className="font-mono text-sm text-muted-foreground">$0.00</CardContent>
        </Card>
      </div>
    </>
  );
}
