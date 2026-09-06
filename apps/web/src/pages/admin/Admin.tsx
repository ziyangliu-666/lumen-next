// Owner: HE RONG. Page: Admin.
import type { JSX } from 'react';
import { Badge } from '@/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { PageHeader } from '@/core/shell';

export function Admin(): JSX.Element {
  return (
    <>
      <PageHeader title="Admin" description="Spend, tenants, and the approvals waiting on you." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Spend</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>example</TableCell>
            <TableCell className="font-mono">$0.00</TableCell>
            <TableCell>
              <Badge className="bg-decide-soft text-decide">over cap</Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}
