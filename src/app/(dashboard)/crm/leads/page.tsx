import Link from "next/link";
import { Target, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listLeads } from "@/modules/crm/leads/service";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { StatusBadge } from "@/components/crm/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LeadsPage() {
  const { organization } = await getActiveOrg();
  const leads = await listLeads(organization.id);

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Track and qualify inbound and outbound leads."
        actions={
          <Button render={<Link href="/crm/leads/new" />}>
            <Plus /> New lead
          </Button>
        }
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="Create your first lead to start building pipeline."
          action={
            <Button render={<Link href="/crm/leads/new" />} size="sm">
              <Plus /> New lead
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/crm/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                    {lead.email ? (
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.source.replaceAll("_", " ").toLowerCase()}
                  </TableCell>
                  <TableCell className="text-sm">{lead.company?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{lead.owner?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{lead.score}</Badge>
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
