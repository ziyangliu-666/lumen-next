// Owner: HE RONG. Page: Settings (account, wallet, keys).
import { Wallet } from './Wallet';
import type { JSX, ReactNode } from 'react';
import { Keys } from './Keys';
import { Column } from './Section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { PageCrumb } from '@/core/shell';

// Settings is a single paper column under the shell's scrolling main, not a
// two-surface page: most tabs have nothing to put beside the content. The
// wallet tab lays out its own summary in the well (see Wallet).
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
      {/* Where you are is in the bar, as on every signed-in page. */}
      <PageCrumb page="Settings" />
      <Tabs value={tab} onValueChange={onTabChange}>
        {/* Wallet is first because #/settings opens it: that is where a run
            over its cap and the Stripe return send people. With Account
            first, the page opened on the second tab. */}
        <TabsList aria-label="Settings">
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6">
          <Column>{accountContent}</Column>
        </TabsContent>
        <TabsContent value="wallet" className="mt-6">
          <Wallet />
        </TabsContent>
        <TabsContent value="keys" className="mt-6">
          <Column>
            <Keys />
          </Column>
        </TabsContent>
      </Tabs>
    </>
  );
}
