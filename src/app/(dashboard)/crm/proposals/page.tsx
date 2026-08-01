import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listProposals } from "@/modules/crm/proposals/service";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { StatusBadge } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils-shared";

export default async function ProposalsPage() {
  const { organization } = await getActiveOrg();
  const proposals = await listProposals(organization.id);

  return (
    <div>
      <PageHeader
        title="Proposals"
        description="Generate and track client proposals."
        actions={
          <Button render={<Link href="/crm/proposals/new" />}>
            <Plus /> New proposal
          </Button>
        }
      />

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          action={
            <Button render={<Link href="/crm/proposals/new" />} size="sm">
              <Plus /> New proposal
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-mono text-xs">{proposal.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/crm/proposals/${proposal.id}`}
                      className="font-medium hover:underline"
                    >
                      {proposal.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{proposal.deal?.title ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={proposal.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(proposal.totalAmount), proposal.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
