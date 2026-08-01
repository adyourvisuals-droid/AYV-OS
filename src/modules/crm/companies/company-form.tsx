"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RelationSelect } from "@/components/crm/relation-select";

export type CompanyFormDefaults = {
  name?: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  ownerId?: string | null;
};

export function CompanyForm({
  action,
  defaults,
  members,
  submitLabel = "Save company",
}: {
  action: (formData: FormData) => void;
  defaults?: CompanyFormDefaults;
  members: { id: string; label: string }[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" defaultValue={defaults?.name} required />
        </Field>
        <Field label="Domain" htmlFor="domain">
          <Input id="domain" name="domain" defaultValue={defaults?.domain ?? ""} />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" name="website" defaultValue={defaults?.website ?? ""} />
        </Field>
        <Field label="Industry" htmlFor="industry">
          <Input id="industry" name="industry" defaultValue={defaults?.industry ?? ""} />
        </Field>
        <Field label="Size" htmlFor="size">
          <Input id="size" name="size" placeholder="e.g. 11-50" defaultValue={defaults?.size ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={defaults?.phone ?? ""} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
        </Field>
        <Field label="Country" htmlFor="country">
          <Input id="country" name="country" defaultValue={defaults?.country ?? ""} />
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
      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" defaultValue={defaults?.address ?? ""} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaults?.description ?? ""}
        />
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
