"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setQuotationStatusAction } from "./actions";

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  DRAFT: [{ label: "Mark as sent", next: "SENT" }],
  SENT: [
    { label: "Mark accepted", next: "ACCEPTED" },
    { label: "Mark rejected", next: "REJECTED" },
  ],
};

export function QuotationStatusActions({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const transitions = TRANSITIONS[status] ?? [];

  if (transitions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {transitions.map((transition) => (
        <Button
          key={transition.next}
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(() => setQuotationStatusAction(id, transition.next))}
        >
          {transition.label}
        </Button>
      ))}
    </div>
  );
}
