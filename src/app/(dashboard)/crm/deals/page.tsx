import Link from "next/link";
import { Plus } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listDealsByStage } from "@/modules/crm/deals/service";
import { PageHeader } from "@/components/crm/page-header";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { Button } from "@/components/ui/button";

export default async function DealsPage() {
  const { organization } = await getActiveOrg();
  const stages = await listDealsByStage(organization.id);

  const board = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    probability: stage.probability,
    isWon: stage.isWon,
    isLost: stage.isLost,
    deals: stage.deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      value: Number(deal.value),
      currency: deal.currency,
      contact: deal.contact,
      company: deal.company,
      owner: deal.owner,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Deal Pipeline"
        description="Drag deals between stages to update your pipeline."
        actions={
          <Button render={<Link href="/crm/deals/new" />}>
            <Plus /> New deal
          </Button>
        }
      />
      {board.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pipeline stages configured yet.
        </p>
      ) : (
        <KanbanBoard stages={board} />
      )}
    </div>
  );
}
