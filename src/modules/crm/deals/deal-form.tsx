"use client";

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
import { RelationSelect } from "@/components/crm/relation-select";

export type DealFormDefaults = {
  title?: string;
  value?: number | string | null;
  currency?: string;
  stageId?: string;
  expectedCloseDate?: Date | string | null;
  contactId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
};

export function DealForm({
  action,
  defaults,
  stages,
  contacts,
  companies,
  members,
  submitLabel = "Save deal",
}: {
  action: (formData: FormData) => void;
  defaults?: DealFormDefaults;
  stages: { id: string; name: string }[];
  contacts: { id: string; label: string }[];
  companies: { id: string; label: string }[];
  members: { id: string; label: string }[];
  submitLabel?: string;
}) {
  const dateValue = defaults?.expectedCloseDate
    ? new Date(defaults.expectedCloseDate).toISOString().slice(0, 10)
    : undefined;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" htmlFor="title" className="col-span-2">
          <Input id="title" name="title" defaultValue={defaults?.title} required />
        </Field>
        <Field label="Value" htmlFor="value">
          <Input
            id="value"
            name="value"
            type="number"
            step="0.01"
            defaultValue={defaults?.value ? String(defaults.value) : ""}
          />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <Input id="currency" name="currency" defaultValue={defaults?.currency ?? "USD"} />
        </Field>
        <Field label="Stage" htmlFor="stageId">
          <Select name="stageId" defaultValue={defaults?.stageId ?? stages[0]?.id}>
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
        </Field>
        <Field label="Expected close date" htmlFor="expectedCloseDate">
          <Input
            id="expectedCloseDate"
            name="expectedCloseDate"
            type="date"
            defaultValue={dateValue}
          />
        </Field>
        <Field label="Company" htmlFor="companyId">
          <RelationSelect
            name="companyId"
            placeholder="Select company"
            defaultValue={defaults?.companyId}
            options={companies}
          />
        </Field>
        <Field label="Contact" htmlFor="contactId">
          <RelationSelect
            name="contactId"
            placeholder="Select contact"
            defaultValue={defaults?.contactId}
            options={contacts}
          />
        </Field>
        <Field label="Owner" htmlFor="ownerId">
          <RelationSelect
            name="ownerId"
            placeholder="Assign owner"
            defaultValue={defaults?.ownerId}
            options={members}
          />
        </Field>
      </div>
      <div>
        <Button type="submit">{submitLabel}</Button>
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
