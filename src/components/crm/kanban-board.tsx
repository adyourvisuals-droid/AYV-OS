"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils-shared";
import { moveDealStageAction } from "@/modules/crm/deals/actions";

export type KanbanDeal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  contact: { firstName: string; lastName: string | null } | null;
  company: { name: string } | null;
  owner: { name: string | null } | null;
};

export type KanbanStage = {
  id: string;
  name: string;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  deals: KanbanDeal[];
};

export function KanbanBoard({ stages }: { stages: KanbanStage[] }) {
  const [board, setBoard] = useState(stages);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(stageId: string) {
    if (!dragging) return;
    const dealId = dragging;
    setDragging(null);

    setBoard((prev) => {
      let moved: KanbanDeal | undefined;
      const withoutDeal = prev.map((stage) => {
        const found = stage.deals.find((d) => d.id === dealId);
        if (found) moved = found;
        return { ...stage, deals: stage.deals.filter((d) => d.id !== dealId) };
      });
      if (!moved) return prev;
      return withoutDeal.map((stage) =>
        stage.id === stageId ? { ...stage, deals: [moved!, ...stage.deals] } : stage
      );
    });

    startTransition(() => {
      void moveDealStageAction(dealId, stageId);
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {board.map((stage) => {
        const stageTotal = stage.deals.reduce((sum, d) => sum + d.value, 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.id)}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40"
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{stage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stage.deals.length} · {formatCurrency(stageTotal)}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {stage.deals.map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => setDragging(deal.id)}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab rounded-md border bg-card p-3 shadow-sm transition-opacity active:cursor-grabbing"
                  style={{ opacity: dragging === deal.id ? 0.5 : 1 }}
                >
                  <Link
                    href={`/crm/deals/${deal.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {deal.title}
                  </Link>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrency(deal.value, deal.currency)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {deal.company?.name ??
                      (deal.contact
                        ? `${deal.contact.firstName} ${deal.contact.lastName ?? ""}`.trim()
                        : "No company")}
                  </p>
                  {deal.owner?.name ? (
                    <Badge variant="outline" className="mt-2">
                      {deal.owner.name}
                    </Badge>
                  ) : null}
                </div>
              ))}
              {stage.deals.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  Drop deals here
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
