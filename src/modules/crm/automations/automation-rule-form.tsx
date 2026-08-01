"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConditionsEditor } from "./conditions-editor";
import { ActionsEditor } from "./actions-editor";
import type { AutomationAction, AutomationCondition } from "./service";
import type { AutomationTrigger } from "@/generated/prisma/enums";

const TRIGGERS: AutomationTrigger[] = [
  "LEAD_CREATED",
  "LEAD_STATUS_CHANGED",
  "DEAL_CREATED",
  "DEAL_STAGE_CHANGED",
];

export type AutomationRuleFormDefaults = {
  name?: string;
  description?: string | null;
  trigger?: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  isActive?: boolean;
};

export function AutomationRuleForm({
  action,
  defaults,
}: {
  action: (formData: FormData) => void;
  defaults?: AutomationRuleFormDefaults;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" defaultValue={defaults?.name} required />
        </Field>
        <Field label="Trigger" htmlFor="trigger">
          <Select name="trigger" defaultValue={defaults?.trigger ?? "LEAD_CREATED"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGERS.map((trigger) => (
                <SelectItem key={trigger} value={trigger}>
                  {trigger.replaceAll("_", " ").toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Active" htmlFor="isActive">
          <div className="flex h-8 items-center gap-2">
            <Checkbox id="isActive" name="isActive" defaultChecked={defaults?.isActive ?? true} />
            <Label htmlFor="isActive" className="text-sm font-normal">
              Rule is active
            </Label>
          </div>
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults?.description ?? ""}
        />
      </Field>
      <Field label="Conditions" htmlFor="conditionsJson">
        <ConditionsEditor name="conditionsJson" defaultConditions={defaults?.conditions} />
      </Field>
      <Field label="Actions" htmlFor="actionsJson">
        <ActionsEditor name="actionsJson" defaultActions={defaults?.actions} />
      </Field>
      <div>
        <Button type="submit">Save rule</Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
