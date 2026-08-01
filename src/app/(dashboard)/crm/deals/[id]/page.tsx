import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileText, Receipt, FileSignature } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { getDeal } from "@/modules/crm/deals/service";
import { deleteDealAction } from "@/modules/crm/deals/actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let deal;
  try {
    deal = await getDeal(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={deal.title}
        description={formatCurrency(Number(deal.value), deal.currency)}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/crm/deals/${deal.id}/edit`} />}>
              <Pencil /> Edit
            </Button>
            <DeleteButton action={deleteDealAction.bind(null, deal.id)} />
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
              <Row label="Stage">
                <Badge variant="secondary">{deal.stage.name}</Badge>
              </Row>
              <Row label="Status"><StatusBadge status={deal.status} /></Row>
              <Row label="Probability">{deal.probability}%</Row>
              <Row label="Expected close">
                {deal.expectedCloseDate
                  ? new Date(deal.expectedCloseDate).toLocaleDateString()
                  : "—"}
              </Row>
              <Row label="Company">
                {deal.company ? (
                  <Link href={`/crm/companies/${deal.company.id}`} className="hover:underline">
                    {deal.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Contact">
                {deal.contact ? (
                  <Link href={`/crm/contacts/${deal.contact.id}`} className="hover:underline">
                    {deal.contact.firstName} {deal.contact.lastName}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Owner">{deal.owner?.name ?? "Unassigned"}</Row>
              {deal.lostReason ? <Row label="Lost reason">{deal.lostReason}</Row> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <DocLink
                icon={FileText}
                href={`/crm/proposals/new?dealId=${deal.id}`}
                label="New proposal"
              />
              <DocLink
                icon={Receipt}
                href={`/crm/quotations/new?dealId=${deal.id}`}
                label="New quotation"
              />
              <DocLink
                icon={FileSignature}
                href={`/crm/contracts/new?dealId=${deal.id}`}
                label="New contract"
              />
              {[...deal.proposals, ...deal.quotations, ...deal.contracts].length === 0 ? (
                <p className="text-xs text-muted-foreground">No documents yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ActivityTimeline activities={deal.activities} relation={{ dealId: deal.id }} />
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

function DocLink({
  icon: Icon,
  href,
  label,
}: {
  icon: typeof FileText;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md border border-dashed p-2 text-sm hover:bg-muted"
    >
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </Link>
  );
}
