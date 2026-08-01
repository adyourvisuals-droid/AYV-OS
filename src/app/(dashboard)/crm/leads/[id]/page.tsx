import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { getLead } from "@/modules/crm/leads/service";
import { listPipelineStages } from "@/modules/crm/pipeline/service";
import { deleteLeadAction } from "@/modules/crm/leads/actions";
import { ConvertLeadForm } from "@/modules/crm/leads/convert-lead-form";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let lead;
  try {
    lead = await getLead(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const stages = lead.convertedDealId ? [] : await listPipelineStages(organization.id);

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={lead.email ?? lead.phone ?? undefined}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/crm/leads/${lead.id}/edit`} />}>
              <Pencil /> Edit
            </Button>
            <DeleteButton action={deleteLeadAction.bind(null, lead.id)} />
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
              <Row label="Status"><StatusBadge status={lead.status} /></Row>
              <Row label="Score"><Badge variant="secondary">{lead.score} pts</Badge></Row>
              <Row label="Source">{lead.source.replaceAll("_", " ").toLowerCase()}</Row>
              <Row label="Budget">
                {lead.budget ? formatCurrency(Number(lead.budget)) : "—"}
              </Row>
              <Row label="Company">
                {lead.company ? (
                  <Link href={`/crm/companies/${lead.company.id}`} className="hover:underline">
                    {lead.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Contact">
                {lead.contact ? (
                  <Link href={`/crm/contacts/${lead.contact.id}`} className="hover:underline">
                    {lead.contact.firstName} {lead.contact.lastName}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Owner">{lead.owner?.name ?? "Unassigned"}</Row>
              {lead.notes ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {lead.convertedDeal ? (
            <Card>
              <CardHeader>
                <CardTitle>Converted deal</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/crm/deals/${lead.convertedDeal.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {lead.convertedDeal.title}
                </Link>
                <p className="text-xs text-muted-foreground">{lead.convertedDeal.stage.name}</p>
              </CardContent>
            </Card>
          ) : (
            <ConvertLeadForm leadId={lead.id} leadName={lead.name} stages={stages} />
          )}
        </div>

        <div className="lg:col-span-2">
          <ActivityTimeline activities={lead.activities} relation={{ leadId: lead.id }} />
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
