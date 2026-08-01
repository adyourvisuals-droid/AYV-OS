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
import { RelationSelect } from "@/components/crm/relation-select";
import type { LeadSource, LeadStatus } from "@/generated/prisma/enums";

const SOURCES: LeadSource[] = [
  "WEBSITE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "EMAIL_CAMPAIGN",
  "ADVERTISEMENT",
  "EVENT",
  "COLD_OUTREACH",
  "WHATSAPP",
  "OTHER",
];

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"];

export type LeadFormDefaults = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  budget?: number | string | null;
  notes?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  ownerId?: string | null;
};

export function LeadForm({
  action,
  defaults,
  companies,
  contacts,
  members,
  submitLabel = "Save lead",
}: {
  action: (formData: FormData) => void;
  defaults?: LeadFormDefaults;
  companies: { id: string; label: string }[];
  contacts: { id: string; label: string }[];
  members: { id: string; label: string }[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" defaultValue={defaults?.name} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={defaults?.phone ?? ""} />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp">
          <Input id="whatsapp" name="whatsapp" defaultValue={defaults?.whatsapp ?? ""} />
        </Field>
        <Field label="Budget" htmlFor="budget">
          <Input
            id="budget"
            name="budget"
            type="number"
            step="0.01"
            defaultValue={defaults?.budget ? String(defaults.budget) : ""}
          />
        </Field>
        <Field label="Source" htmlFor="source">
          <Select name="source" defaultValue={defaults?.source ?? "OTHER"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source.replaceAll("_", " ").toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select name="status" defaultValue={defaults?.status ?? "NEW"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replaceAll("_", " ").toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={4} defaultValue={defaults?.notes ?? ""} />
      </Field>
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
