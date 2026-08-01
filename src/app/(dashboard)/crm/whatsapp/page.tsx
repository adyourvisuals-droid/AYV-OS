import { MessageCircle } from "lucide-react";
import { ActivityModulePage } from "@/components/crm/activity-module-page";

export default function WhatsAppPage() {
  return (
    <ActivityModulePage
      type="WHATSAPP"
      title="WhatsApp Timeline"
      description="Logged WhatsApp conversations across your CRM records."
      icon={MessageCircle}
    />
  );
}
