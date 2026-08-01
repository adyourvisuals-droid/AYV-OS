import { Phone } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function CallsPage() {
  return (
    <ActivityModulePage
      type="CALL"
      title="Calls"
      description="Logged inbound and outbound calls."
      icon={Phone}
    />
  );
}
