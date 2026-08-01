"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RelationSelect } from "@/components/crm/relation-select";

export function ContractForm({
  action,
  deals,
  contacts,
  companies,
  defaultDealId,
}: {
  action: (formData: FormData) => void;
  deals: { id: string; label: string }[];
  contacts: { id: string; label: string }[];
  companies: { id: string; label: string }[];
  defaultDealId?: string;
}) {
  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" htmlFor="title" className="col-span-2">
          <Input id="title" name="title" placeholder="Master Services Agreement" required />
        </Field>
        <Field label="Deal" htmlFor="dealId">
          <RelationSelect
            name="dealId"
            placeholder="Link a deal"
            defaultValue={defaultDealId}
            options={deals}
          />
        </Field>
        <Field label="Value" htmlFor="value">
          <Input id="value" name="value" type="number" step="0.01" />
        </Field>
        <Field label="Contact" htmlFor="contactId">
          <RelationSelect name="contactId" placeholder="Select contact" options={contacts} />
        </Field>
        <Field label="Company" htmlFor="companyId">
          <RelationSelect name="companyId" placeholder="Select company" options={companies} />
        </Field>
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" />
        </Field>
        <Field label="End date" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" />
        </Field>
      </div>
      <Field label="Contract terms" htmlFor="content">
        <Textarea id="content" name="content" rows={10} placeholder="Scope of work, terms & conditions…" />
      </Field>
      <div>
        <Button type="submit">Save contract</Button>
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
