import { CalendarClock } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function FollowUpsPage() {
  return (
    <ActivityModulePage
      type="FOLLOW_UP"
      title="Follow-ups"
      description="Scheduled follow-ups so nothing falls through the cracks."
      icon={CalendarClock}
    />
  );
}
