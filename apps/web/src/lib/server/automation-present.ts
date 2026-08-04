export function presentRule(rule: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: string;
  triggerKey: string;
  conditions: unknown;
  actions: unknown;
  runCount: number;
  lastRunAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}) {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    isActive: rule.isActive,
    triggerType: rule.triggerType,
    triggerKey: rule.triggerKey,
    conditions: rule.conditions,
    actions: rule.actions,
    runCount: rule.runCount,
    lastRunAt: rule.lastRunAt?.toISOString() ?? null,
    lastError: rule.lastError,
    createdAt: rule.createdAt.toISOString(),
  };
}
