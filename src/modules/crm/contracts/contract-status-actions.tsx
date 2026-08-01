"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setContractStatusAction } from "./actions";

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  DRAFT: [{ label: "Mark as sent", next: "SENT" }],
  SENT: [{ label: "Mark signed", next: "SIGNED" }],
  SIGNED: [{ label: "Terminate", next: "TERMINATED" }],
};

export function ContractStatusActions({ id, status }: { id: string; status: string }) {
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
          onClick={() => startTransition(() => setContractStatusAction(id, transition.next))}
        >
          {transition.label}
        </Button>
      ))}
    </div>
  );
}
