import {
  LayoutDashboard,
  Target,
  KanbanSquare,
  Users,
  Building2,
  ListChecks,
  StickyNote,
  CalendarClock,
  Video,
  Phone,
  FileText,
  Receipt,
  FileSignature,
  BellRing,
  Mail,
  MessageCircle,
  Zap,
} from "lucide-react";

import { registerModule, type ModuleDescriptor } from "@/lib/module-registry";

const iconClass = "size-4";

export const crmModule: ModuleDescriptor = {
  id: "crm",
  label: "CRM",
  icon: <Target className={iconClass} />,
  basePath: "/crm",
  sections: [
    {
      label: "Overview",
      items: [
        { label: "Sales Dashboard", href: "/crm", icon: <LayoutDashboard className={iconClass} /> },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { label: "Leads", href: "/crm/leads", icon: <Target className={iconClass} /> },
        { label: "Deals", href: "/crm/deals", icon: <KanbanSquare className={iconClass} /> },
        { label: "Contacts", href: "/crm/contacts", icon: <Users className={iconClass} /> },
        { label: "Companies", href: "/crm/companies", icon: <Building2 className={iconClass} /> },
      ],
    },
    {
      label: "Activities",
      items: [
        { label: "Tasks", href: "/crm/tasks", icon: <ListChecks className={iconClass} /> },
        { label: "Notes", href: "/crm/notes", icon: <StickyNote className={iconClass} /> },
        { label: "Meetings", href: "/crm/meetings", icon: <Video className={iconClass} /> },
        { label: "Calls", href: "/crm/calls", icon: <Phone className={iconClass} /> },
        { label: "Follow-ups", href: "/crm/follow-ups", icon: <CalendarClock className={iconClass} /> },
        { label: "Email Timeline", href: "/crm/emails", icon: <Mail className={iconClass} /> },
        { label: "WhatsApp Timeline", href: "/crm/whatsapp", icon: <MessageCircle className={iconClass} /> },
      ],
    },
    {
      label: "Documents",
      items: [
        { label: "Proposals", href: "/crm/proposals", icon: <FileText className={iconClass} /> },
        { label: "Quotations", href: "/crm/quotations", icon: <Receipt className={iconClass} /> },
        { label: "Contracts", href: "/crm/contracts", icon: <FileSignature className={iconClass} /> },
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Automation Rules", href: "/crm/automations", icon: <Zap className={iconClass} /> },
        { label: "Lead Scoring", href: "/crm/lead-scoring", icon: <BellRing className={iconClass} /> },
      ],
    },
  ],
};

registerModule(crmModule);
