import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listCompanies } from "@/modules/crm/companies/service";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
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

export default async function CompaniesPage() {
  const { organization } = await getActiveOrg();
  const companies = await listCompanies(organization.id);

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Organizations you sell to."
        actions={
          <Button render={<Link href="/crm/companies/new" />}>
            <Plus /> New company
          </Button>
        }
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add a company to start linking contacts and deals."
          action={
            <Button render={<Link href="/crm/companies/new" />} size="sm">
              <Plus /> New company
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/crm/companies/${company.id}`}
                      className="font-medium hover:underline"
                    >
                      {company.name}
                    </Link>
                    {company.domain ? (
                      <div className="text-xs text-muted-foreground">{company.domain}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {company.industry ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{company._count.contacts}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{company._count.deals}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{company.owner?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
