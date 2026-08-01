import { Mail } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function EmailsPage() {
  return (
    <ActivityModulePage
      type="EMAIL"
      title="Email Timeline"
      description="Logged email correspondence across your CRM records."
      icon={Mail}
    />
  );
}
