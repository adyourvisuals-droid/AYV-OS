import { notFound } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { getProposal } from "@/modules/crm/proposals/service";
import { deleteProposalAction } from "@/modules/crm/proposals/actions";
import { ProposalStatusActions } from "@/modules/crm/proposals/proposal-status-actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let proposal;
  try {
    proposal = await getProposal(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const subtotal = proposal.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );

  return (
    <div>
      <PageHeader
        title={proposal.title}
        description={`${proposal.number} · ${proposal.deal?.title ?? "No linked deal"}`}
        actions={
          <>
            <ProposalStatusActions id={proposal.id} status={proposal.status} />
            <DeleteButton action={deleteProposalAction.bind(null, proposal.id)} />
          </>
        }
      />

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-6 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Proposal</p>
              <h2 className="text-lg font-semibold">{proposal.title}</h2>
              <p className="text-sm text-muted-foreground">{proposal.number}</p>
            </div>
            <StatusBadge status={proposal.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prepared for</p>
              <p>
                {proposal.company?.name ??
                  (proposal.contact
                    ? `${proposal.contact.firstName} ${proposal.contact.lastName ?? ""}`.trim()
                    : "—")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Valid until</p>
              <p>
                {proposal.validUntil
                  ? new Date(proposal.validUntil).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          {proposal.summary ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Summary</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{proposal.summary}</p>
            </div>
          ) : null}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {proposal.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </td>
                  <td className="py-2">{Number(item.quantity)}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(Number(item.unitPrice), proposal.currency)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(
                      Number(item.quantity) * Number(item.unitPrice),
                      proposal.currency
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, proposal.currency)}</span>
              </div>
              <div className="flex justify-between border-t py-1 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(Number(proposal.totalAmount), proposal.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
