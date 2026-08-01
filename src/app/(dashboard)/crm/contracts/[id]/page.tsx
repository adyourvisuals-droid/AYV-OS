import { notFound } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { getContract } from "@/modules/crm/contracts/service";
import { deleteContractAction } from "@/modules/crm/contracts/actions";
import { ContractStatusActions } from "@/modules/crm/contracts/contract-status-actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let contract;
  try {
    contract = await getContract(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={contract.title}
        description={`${contract.number} · ${contract.deal?.title ?? "No linked deal"}`}
        actions={
          <>
            <ContractStatusActions id={contract.id} status={contract.status} />
            <DeleteButton action={deleteContractAction.bind(null, contract.id)} />
          </>
        }
      />

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-6 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Contract</p>
              <h2 className="text-lg font-semibold">{contract.title}</h2>
              <p className="text-sm text-muted-foreground">{contract.number}</p>
            </div>
            <StatusBadge status={contract.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Party</p>
              <p>
                {contract.company?.name ??
                  (contract.contact
                    ? `${contract.contact.firstName} ${contract.contact.lastName ?? ""}`.trim()
                    : "—")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Value</p>
              <p>{formatCurrency(Number(contract.value), contract.currency)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Start date</p>
              <p>{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">End date</p>
              <p>{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          {contract.content ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Terms</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{contract.content}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
