import { createAutomationRuleAction } from "@/modules/crm/automations/actions";
import { AutomationRuleForm } from "@/modules/crm/automations/automation-rule-form";
import { PageHeader } from "@/components/crm/page-header";

export default function NewAutomationRulePage() {
  return (
    <div>
      <PageHeader
        title="New automation rule"
        description="Define a trigger, conditions, and actions to run automatically."
      />
      <AutomationRuleForm action={createAutomationRuleAction} />
    </div>
  );
}
