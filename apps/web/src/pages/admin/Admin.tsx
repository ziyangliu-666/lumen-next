// Owner: HE RONG. Page: Admin.
import type { JSX } from 'react';
import { Badge } from '@/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { PageHeader } from '@/core/shell';

export function Admin(): JSX.Element {
  return (
    <>
      <PageHeader
        title="Admin"
        description="Every account: who they are, what they can do, what they cost."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Spend</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>a.li@example.edu</TableCell>
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
