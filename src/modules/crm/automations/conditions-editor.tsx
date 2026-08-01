"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AutomationCondition } from "./service";

const OPERATORS: AutomationCondition["operator"][] = [
  "IS_SET",
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "GREATER_THAN",
  "LESS_THAN",
];

export function ConditionsEditor({
  name,
  defaultConditions,
}: {
  name: string;
  defaultConditions?: AutomationCondition[];
}) {
  const [conditions, setConditions] = useState<AutomationCondition[]>(defaultConditions ?? []);

  function update(index: number, patch: Partial<AutomationCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(conditions)} />
      {conditions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No conditions — the rule runs for every matching trigger.
        </p>
      ) : null}
      {conditions.map((condition, index) => (
        <div key={index} className="grid grid-cols-[1fr_140px_1fr_36px] items-center gap-2">
          <Input
            placeholder="Field (e.g. source, status, budget)"
            value={condition.field}
            onChange={(e) => update(index, { field: e.target.value })}
          />
          <Select
            value={condition.operator}
            onValueChange={(value) =>
              update(index, { operator: value as AutomationCondition["operator"] })
            }
          >
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
          <Input
            placeholder="Value"
            value={condition.value ?? ""}
            onChange={(e) => update(index, { value: e.target.value })}
            disabled={condition.operator === "IS_SET"}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          setConditions((prev) => [...prev, { field: "", operator: "IS_SET", value: "" }])
        }
      >
        <Plus /> Add condition
      </Button>
    </div>
  );
}
