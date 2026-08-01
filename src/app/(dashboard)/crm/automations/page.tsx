import Link from "next/link";
import { Zap, Plus, Pencil } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listAutomationRules } from "@/modules/crm/automations/service";
import { deleteAutomationRuleAction, toggleAutomationRuleAction } from "@/modules/crm/automations/actions";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { DeleteButton } from "@/components/crm/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AutomationsPage() {
  const { organization } = await getActiveOrg();
  const rules = await listAutomationRules(organization.id);

  return (
    <div>
      <PageHeader
        title="Automation Rules"
        description="Automatically assign owners, change statuses, create tasks and more."
        actions={
          <Button render={<Link href="/crm/automations/new" />}>
            <Plus /> New rule
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automation rules yet"
          action={
            <Button render={<Link href="/crm/automations/new" />} size="sm">
              <Plus /> New rule
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {rule.name}
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rule.trigger.replaceAll("_", " ").toLowerCase()}
                    {rule.description ? ` · ${rule.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleAutomationRuleAction.bind(null, rule.id, !rule.isActive)}>
                    <Button type="submit" size="sm" variant="outline">
                      {rule.isActive ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <Button size="sm" variant="outline" render={<Link href={`/crm/automations/${rule.id}/edit`} />}>
                    <Pencil />
                  </Button>
                  <DeleteButton action={deleteAutomationRuleAction.bind(null, rule.id)} />
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {(rule.conditions as unknown as { field: string }[])?.length ?? 0} condition(s) ·{" "}
                {(rule.actions as unknown as { type: string }[])?.length ?? 0} action(s)
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
