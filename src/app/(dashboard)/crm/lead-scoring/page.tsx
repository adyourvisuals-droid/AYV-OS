import { BellRing } from "lucide-react";

import { getActiveOrg } from "@/lib/session";
import { listLeadScoringRules } from "@/modules/crm/leads/scoring-rules";
import { deleteLeadScoringRuleAction } from "@/modules/crm/leads/scoring-rules-actions";
import { LeadScoringRuleForm } from "@/modules/crm/leads/lead-scoring-rule-form";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/crm/empty-state";
import { DeleteButton } from "@/components/crm/delete-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LeadScoringPage() {
  const { organization } = await getActiveOrg();
  const rules = await listLeadScoringRules(organization.id);

  return (
    <div>
      <PageHeader
        title="Lead Scoring"
        description="Rules that automatically score leads as they're created or updated."
        actions={<LeadScoringRuleForm />}
      />

      {rules.length === 0 ? (
        <EmptyState icon={BellRing} title="No scoring rules yet" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.field} {rule.operator.replaceAll("_", " ").toLowerCase()}
                    {rule.value ? ` "${rule.value}"` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.points >= 0 ? "default" : "destructive"}>
                      {rule.points > 0 ? `+${rule.points}` : rule.points}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton action={deleteLeadScoringRuleAction.bind(null, rule.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
