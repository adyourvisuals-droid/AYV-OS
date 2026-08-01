import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listContracts } from "@/modules/crm/contracts/service";
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

export default async function ContractsPage() {
  const { organization } = await getActiveOrg();
  const contracts = await listContracts(organization.id);

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Signed agreements with your clients."
        actions={
          <Button render={<Link href="/crm/contracts/new" />}>
            <Plus /> New contract
          </Button>
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No contracts yet"
          action={
            <Button render={<Link href="/crm/contracts/new" />} size="sm">
              <Plus /> New contract
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
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-mono text-xs">{contract.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/crm/contracts/${contract.id}`}
                      className="font-medium hover:underline"
                    >
                      {contract.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{contract.deal?.title ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(contract.value), contract.currency)}
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
