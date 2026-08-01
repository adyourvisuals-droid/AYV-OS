import { ListChecks } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function TasksPage() {
  return (
    <ActivityModulePage
      type="TASK"
      title="Tasks"
      description="To-dos for your team, linked to leads, deals, contacts or companies."
      icon={ListChecks}
    />
  );
}
