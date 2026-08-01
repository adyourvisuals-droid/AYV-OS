import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { getCompany } from "@/modules/crm/companies/service";
import { deleteCompanyAction } from "@/modules/crm/companies/actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let company;
  try {
    company = await getCompany(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={company.name}
        description={company.industry ?? company.domain ?? undefined}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/crm/companies/${company.id}/edit`} />}>
              <Pencil /> Edit
            </Button>
            <DeleteButton action={deleteCompanyAction.bind(null, company.id)} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label="Website">{company.website ?? "—"}</Row>
              <Row label="Phone">{company.phone ?? "—"}</Row>
              <Row label="Size">{company.size ?? "—"}</Row>
              <Row label="Location">
                {[company.city, company.country].filter(Boolean).join(", ") || "—"}
              </Row>
              <Row label="Owner">{company.owner?.name ?? "Unassigned"}</Row>
              {company.description ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{company.description}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contacts</CardTitle>
              <Button size="sm" variant="ghost" render={<Link href={`/crm/contacts/new?companyId=${company.id}`} />}>
                <Plus />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {company.contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts yet.</p>
              ) : null}
              {company.contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/crm/contacts/${contact.id}`}
                  className="text-sm hover:underline"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {company.deals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deals yet.</p>
              ) : null}
              {company.deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/crm/deals/${deal.id}`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span>{deal.title}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={deal.status} />
                    <Badge variant="secondary">{formatCurrency(Number(deal.value))}</Badge>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ActivityTimeline activities={company.activities} relation={{ companyId: company.id }} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
