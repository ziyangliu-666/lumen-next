// Owner: LU YI. Page: Sign in / sign up.
import type { JSX } from 'react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';

export function SignIn(): JSX.Element {
  return (
    <Card className="mx-auto mt-12 w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>GitHub, Google, or your email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">Continue</Button>
        <Separator />
        <Button variant="outline" className="w-full">
          Continue with GitHub
        </Button>
      </CardContent>
    </Card>
  );
}
