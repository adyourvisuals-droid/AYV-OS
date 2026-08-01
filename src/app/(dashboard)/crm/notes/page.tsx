import { StickyNote } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function NotesPage() {
  return (
    <ActivityModulePage
      type="NOTE"
      title="Notes"
      description="Freeform notes attached to your CRM records."
      icon={StickyNote}
    />
  );
}
