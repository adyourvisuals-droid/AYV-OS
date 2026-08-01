"use client";

import { useState } from "react";
import {
  StickyNote,
  ListChecks,
  Video,
  Phone,
  CalendarClock,
  Mail,
  MessageCircle,
  Plus,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ActivityType } from "@/generated/prisma/enums";
import { createActivityAction, completeActivityAction } from "@/modules/crm/activities/actions";

const TYPE_META: Record<ActivityType, { label: string; icon: typeof StickyNote }> = {
  NOTE: { label: "Note", icon: StickyNote },
  TASK: { label: "Task", icon: ListChecks },
  MEETING: { label: "Meeting", icon: Video },
  CALL: { label: "Call", icon: Phone },
  FOLLOW_UP: { label: "Follow-up", icon: CalendarClock },
  EMAIL: { label: "Email", icon: Mail },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
};

export type TimelineActivity = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  status: string;
  dueDate: Date | string | null;
  createdAt: Date | string;
  assignedTo?: { name: string | null } | null;
};

export function ActivityTimeline({
  activities,
  relation,
}: {
  activities: TimelineActivity[];
  relation: { leadId?: string; dealId?: string; contactId?: string; companyId?: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Activity timeline</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus /> {open ? "Cancel" : "Log activity"}
        </Button>
      </div>

      {open ? (
        <form
          action={async (formData) => {
            await createActivityAction(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          {relation.leadId ? <input type="hidden" name="leadId" value={relation.leadId} /> : null}
          {relation.dealId ? <input type="hidden" name="dealId" value={relation.dealId} /> : null}
          {relation.contactId ? (
            <input type="hidden" name="contactId" value={relation.contactId} />
          ) : null}
          {relation.companyId ? (
            <input type="hidden" name="companyId" value={relation.companyId} />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Select name="type" defaultValue="NOTE">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="datetime-local" name="dueDate" />
          </div>
          <Input name="subject" placeholder="Subject" required />
          <Textarea name="body" placeholder="Details (optional)" rows={3} />
          <div>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : null}
        {activities.map((activity) => {
          const meta = TYPE_META[activity.type];
          const Icon = meta.icon;
          const isTaskLike = activity.type === "TASK" || activity.type === "FOLLOW_UP";
          const isDone = activity.status === "DONE";
          return (
            <div key={activity.id} className="flex gap-3 rounded-lg border p-3">
              <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{activity.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
                {activity.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">{activity.body}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{meta.label}</Badge>
                  {activity.dueDate ? (
                    <Badge variant="secondary">
                      Due {new Date(activity.dueDate).toLocaleDateString()}
                    </Badge>
                  ) : null}
                  {isTaskLike && !isDone ? (
                    <form action={completeActivityAction.bind(null, activity.id)}>
                      <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs">
                        <Check /> Mark done
                      </Button>
                    </form>
                  ) : null}
                  {isTaskLike && isDone ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600">Done</Badge>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
