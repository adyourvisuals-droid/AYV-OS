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
import type { AutomationAction } from "./service";

const ACTION_TYPES: AutomationAction["type"][] = [
  "ASSIGN_OWNER",
  "CHANGE_STATUS",
  "CREATE_TASK",
  "CREATE_FOLLOW_UP",
  "ADJUST_SCORE",
  "MOVE_STAGE",
];

const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  ASSIGN_OWNER: "Assign owner",
  CHANGE_STATUS: "Change lead status",
  CREATE_TASK: "Create a task",
  CREATE_FOLLOW_UP: "Create a follow-up",
  ADJUST_SCORE: "Adjust lead score",
  MOVE_STAGE: "Move deal stage",
};

const VALUE_PLACEHOLDER: Record<AutomationAction["type"], string> = {
  ASSIGN_OWNER: "User ID to assign",
  CHANGE_STATUS: "New status (e.g. QUALIFIED)",
  CREATE_TASK: "Task subject",
  CREATE_FOLLOW_UP: "Follow-up subject",
  ADJUST_SCORE: "Points (e.g. 10 or -5)",
  MOVE_STAGE: "Pipeline stage ID",
};

function actionToValue(action: AutomationAction): string {
  switch (action.type) {
    case "ASSIGN_OWNER":
      return action.ownerId;
    case "CHANGE_STATUS":
      return action.status;
    case "CREATE_TASK":
    case "CREATE_FOLLOW_UP":
      return action.subject;
    case "ADJUST_SCORE":
      return String(action.delta);
    case "MOVE_STAGE":
      return action.stageId;
    default:
      return "";
  }
}

function buildAction(type: AutomationAction["type"], value: string): AutomationAction {
  switch (type) {
    case "ASSIGN_OWNER":
      return { type, ownerId: value };
    case "CHANGE_STATUS":
      return { type, status: value };
    case "CREATE_TASK":
    case "CREATE_FOLLOW_UP":
      return { type, subject: value, dueInDays: 1 };
    case "ADJUST_SCORE":
      return { type, delta: Number(value) || 0 };
    case "MOVE_STAGE":
      return { type, stageId: value };
  }
}

export function ActionsEditor({
  name,
  defaultActions,
}: {
  name: string;
  defaultActions?: AutomationAction[];
}) {
  const [actions, setActions] = useState<AutomationAction[]>(defaultActions ?? []);

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(actions)} />
      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add at least one action to take.</p>
      ) : null}
      {actions.map((action, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_36px] items-center gap-2">
          <Select
            value={action.type}
            onValueChange={(value) =>
              setActions((prev) =>
                prev.map((a, i) =>
                  i === index
                    ? buildAction(value as AutomationAction["type"], actionToValue(a))
                    : a
                )
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {ACTION_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={VALUE_PLACEHOLDER[action.type]}
            value={actionToValue(action)}
            onChange={(e) =>
              setActions((prev) =>
                prev.map((a, i) => (i === index ? buildAction(a.type, e.target.value) : a))
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setActions((prev) => prev.filter((_, i) => i !== index))}
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
        onClick={() => setActions((prev) => [...prev, { type: "CREATE_TASK", subject: "", dueInDays: 1 }])}
      >
        <Plus /> Add action
      </Button>
    </div>
  );
}
