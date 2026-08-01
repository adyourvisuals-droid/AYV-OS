"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RelationSelect } from "@/components/crm/relation-select";
import type { ActivityType } from "@/generated/prisma/enums";
import { createActivityAction } from "@/modules/crm/activities/actions";

const SHOWS_SCHEDULE: ActivityType[] = ["TASK", "MEETING", "FOLLOW_UP"];
const SHOWS_DIRECTION: ActivityType[] = ["CALL", "EMAIL", "WHATSAPP"];

export function ActivityQuickForm({
  type,
  leads,
  deals,
  contacts,
  companies,
}: {
  type: ActivityType;
  leads: { id: string; label: string }[];
  deals: { id: string; label: string }[];
  contacts: { id: string; label: string }[];
  companies: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New
      </Button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createActivityAction(formData);
        setOpen(false);
      }}
      className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="subject" placeholder="Subject" required />
        {SHOWS_SCHEDULE.includes(type) ? (
          <Input type="datetime-local" name="dueDate" placeholder="Due date" />
        ) : (
          <div />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RelationSelect name="leadId" placeholder="Lead" options={leads} />
        <RelationSelect name="dealId" placeholder="Deal" options={deals} />
        <RelationSelect name="contactId" placeholder="Contact" options={contacts} />
        <RelationSelect name="companyId" placeholder="Company" options={companies} />
      </div>
      {SHOWS_DIRECTION.includes(type) ? (
        <div className="grid grid-cols-2 gap-3">
          <RelationSelect
            name="direction"
            placeholder="Direction"
            allowEmpty={false}
            options={[
              { id: "INBOUND", label: "Inbound" },
              { id: "OUTBOUND", label: "Outbound" },
            ]}
          />
          <Input name="toAddress" placeholder={type === "CALL" ? "Phone number" : "Address"} />
        </div>
      ) : null}
      <Textarea name="body" placeholder="Notes (optional)" rows={3} />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
