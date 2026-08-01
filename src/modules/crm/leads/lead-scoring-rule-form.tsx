"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createLeadScoringRuleAction } from "./scoring-rules-actions";

const OPERATORS = ["IS_SET", "EQUALS", "NOT_EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN"];

export function LeadScoringRuleForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New rule
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createLeadScoringRuleAction(formData);
        setOpen(false);
      }}
      className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input name="name" placeholder="Rule name" required />
        <Input name="points" type="number" placeholder="Points (e.g. 10 or -5)" required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input name="field" placeholder="Field (e.g. source, budget, email)" required />
        <Select name="operator" defaultValue="IS_SET">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op} value={op}>
                {op.replaceAll("_", " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input name="value" placeholder="Comparison value" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="isActive" name="isActive" defaultChecked />
        <Label htmlFor="isActive" className="text-sm font-normal">
          Active
        </Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save rule
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
