import { getActiveOrg } from "@/lib/session";
import { getAutomationRule } from "@/modules/crm/automations/service";
import { updateAutomationRuleAction } from "@/modules/crm/automations/actions";
import { AutomationRuleForm } from "@/modules/crm/automations/automation-rule-form";
import type { AutomationAction, AutomationCondition } from "@/modules/crm/automations/service";
import { PageHeader } from "@/components/crm/page-header";

export default async function EditAutomationRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();
  const rule = await getAutomationRule(organization.id, id);

  return (
    <div>
      <PageHeader title={`Edit ${rule.name}`} />
      <AutomationRuleForm
        action={updateAutomationRuleAction.bind(null, id)}
        defaults={{
          ...rule,
          conditions: rule.conditions as unknown as AutomationCondition[],
          actions: rule.actions as unknown as AutomationAction[],
        }}
      />
    </div>
  );
}
