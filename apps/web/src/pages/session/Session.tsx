// Owners: LIU ZIYANG (graph, call tree) and LI ZHUOYANG (composer, files).
// The two halves below are the agreed boundary between them: each owner works
// inside their own panel and neither restyles the other's.
import type { JSX } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Textarea } from '@/ui/textarea';
import { PageHeader } from '@/core/shell';

export function Session(): JSX.Element {
  return (
    <>
      <PageHeader title="Session" description="One question, and every agent it reached." />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* LIU ZIYANG: the graph and the call tree. */}
        <Card className="min-h-96">
          <CardHeader>
            <CardTitle className="text-base">Call graph</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Points and the four edge kinds render here.
          </CardContent>
        </Card>
        {/* LI ZHUOYANG: the composer and the files panel. */}
        <Card className="min-h-96">
          <CardHeader>
            <CardTitle className="text-base">Steer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Say something to the run…" rows={4} />
            <Button className="w-full">Queue for the next step</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
