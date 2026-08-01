"use client";

import { useState } from "react";
import { ArrowRightCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertLeadAction } from "./actions";

export function ConvertLeadForm({
  leadId,
  leadName,
  stages,
}: {
  leadId: string;
  leadName: string;
  stages: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const action = convertLeadAction.bind(null, leadId);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArrowRightCircle /> Convert to deal
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Deal title</Label>
        <Input id="title" name="title" defaultValue={`${leadName} — Deal`} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stageId">Stage</Label>
          <Select name="stageId" defaultValue={stages[0]?.id}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="value">Deal value</Label>
          <Input id="value" name="value" type="number" step="0.01" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Create deal</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
