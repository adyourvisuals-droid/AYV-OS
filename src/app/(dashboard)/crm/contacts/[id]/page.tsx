import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { getContact } from "@/modules/crm/contacts/service";
import { deleteContactAction } from "@/modules/crm/contacts/actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let contact;
  try {
    contact = await getContact(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName ?? ""}`}
        description={contact.title ?? contact.email ?? undefined}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/crm/contacts/${contact.id}/edit`} />}>
              <Pencil /> Edit
            </Button>
            <DeleteButton action={deleteContactAction.bind(null, contact.id)} />
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
              <Row label="Email">{contact.email ?? "—"}</Row>
              <Row label="Phone">{contact.phone ?? "—"}</Row>
              <Row label="WhatsApp">{contact.whatsapp ?? "—"}</Row>
              <Row label="Company">
                {contact.company ? (
                  <Link href={`/crm/companies/${contact.company.id}`} className="hover:underline">
                    {contact.company.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Owner">{contact.owner?.name ?? "Unassigned"}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {contact.deals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No deals yet.</p>
              ) : null}
              {contact.deals.map((deal) => (
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
          <ActivityTimeline activities={contact.activities} relation={{ contactId: contact.id }} />
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
