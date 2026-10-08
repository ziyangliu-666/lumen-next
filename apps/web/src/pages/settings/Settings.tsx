// Owner: HE RONG. Page: Settings (account, wallet, keys).
import { Wallet } from './Wallet';
import type { JSX, ReactNode } from 'react';
import { Keys } from './Keys';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { PageHeader } from '@/core/shell';

export function Settings({
  accountContent,
  tab,
  onTabChange,
}: {
  readonly accountContent: ReactNode;
  readonly tab: 'account' | 'wallet' | 'keys';
  readonly onTabChange: (tab: string) => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-4">
          {accountContent}
        </TabsContent>
        <TabsContent value="wallet" className="mt-4">
          <Wallet />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <Keys />
        </TabsContent>
      </Tabs>
    </>
  );
}
