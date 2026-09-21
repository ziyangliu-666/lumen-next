// Owner: HE RONG. Page: Settings (account, wallet, keys).
import { Wallet } from './Wallet';
import type { JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { PageHeader } from '@/core/shell';

export function Settings(): JSX.Element {
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs defaultValue="wallet">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              LU YI owns this tab: the identity slice reaches into it.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="wallet" className="mt-4">
          <Wallet />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API keys</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A key belongs to one account and is never shown again after it is saved.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
