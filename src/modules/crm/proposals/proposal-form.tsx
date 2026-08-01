"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RelationSelect } from "@/components/crm/relation-select";
import { LineItemsEditor, type LineItem } from "@/components/crm/line-items-editor";

export function ProposalForm({
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
  const defaultItems: LineItem[] = [
    { name: "Strategy & consulting", description: "", quantity: 1, unitPrice: 0 },
  ];

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" htmlFor="title" className="col-span-2">
          <Input id="title" name="title" placeholder="Q3 Marketing Retainer Proposal" required />
        </Field>
        <Field label="Deal" htmlFor="dealId">
          <RelationSelect
            name="dealId"
            placeholder="Link a deal"
            defaultValue={defaultDealId}
            options={deals}
          />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <Input id="currency" name="currency" defaultValue="USD" />
        </Field>
        <Field label="Contact" htmlFor="contactId">
          <RelationSelect name="contactId" placeholder="Select contact" options={contacts} />
        </Field>
        <Field label="Company" htmlFor="companyId">
          <RelationSelect name="companyId" placeholder="Select company" options={companies} />
        </Field>
        <Field label="Valid until" htmlFor="validUntil">
          <Input id="validUntil" name="validUntil" type="date" />
        </Field>
      </div>
      <Field label="Summary" htmlFor="summary">
        <Textarea id="summary" name="summary" rows={3} placeholder="Executive summary" />
      </Field>
      <Field label="Line items" htmlFor="itemsJson">
        <LineItemsEditor name="itemsJson" defaultItems={defaultItems} />
      </Field>
      <div>
        <Button type="submit">Generate proposal</Button>
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
