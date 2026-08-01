"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RelationSelect } from "@/components/crm/relation-select";

export type ContactFormDefaults = {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  title?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
};

export function ContactForm({
  action,
  defaults,
  companies,
  members,
  submitLabel = "Save contact",
}: {
  action: (formData: FormData) => void;
  defaults?: ContactFormDefaults;
  companies: { id: string; label: string }[];
  members: { id: string; label: string }[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" defaultValue={defaults?.firstName} required />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" defaultValue={defaults?.lastName ?? ""} />
        </Field>
        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" defaultValue={defaults?.title ?? ""} />
        </Field>
        <Field label="Company" htmlFor="companyId">
          <RelationSelect
            name="companyId"
            placeholder="Select company"
            defaultValue={defaults?.companyId}
            options={companies}
          />
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
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
