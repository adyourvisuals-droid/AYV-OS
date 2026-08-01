"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  confirmMessage = "Are you sure? This cannot be undone.",
  label = "Delete",
}: {
  action: () => Promise<void>;
  confirmMessage?: string;
  label?: string;
}) {
  return (
    <form
      action={async () => {
        if (typeof window !== "undefined" && !window.confirm(confirmMessage)) return;
        await action();
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        <Trash2 />
        {label}
      </Button>
    </form>
  );
}
