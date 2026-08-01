import { Video } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function MeetingsPage() {
  return (
    <ActivityModulePage
      type="MEETING"
      title="Meetings"
      description="Scheduled meetings with leads and customers."
      icon={Video}
    />
  );
}
