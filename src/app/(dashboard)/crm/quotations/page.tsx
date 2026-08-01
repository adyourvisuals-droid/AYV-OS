import Link from "next/link";
import { Receipt, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listQuotations } from "@/modules/crm/quotations/service";
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

export default async function QuotationsPage() {
  const { organization } = await getActiveOrg();
  const quotations = await listQuotations(organization.id);

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Itemized price quotations for prospects."
        actions={
          <Button render={<Link href="/crm/quotations/new" />}>
            <Plus /> New quotation
          </Button>
        }
      />

      {quotations.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No quotations yet"
          action={
            <Button render={<Link href="/crm/quotations/new" />} size="sm">
              <Plus /> New quotation
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
              {quotations.map((quotation) => (
                <TableRow key={quotation.id}>
                  <TableCell className="font-mono text-xs">{quotation.number}</TableCell>
                  <TableCell>
                    <Link
                      href={`/crm/quotations/${quotation.id}`}
                      className="font-medium hover:underline"
                    >
                      {quotation.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{quotation.deal?.title ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={quotation.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(quotation.totalAmount), quotation.currency)}
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
