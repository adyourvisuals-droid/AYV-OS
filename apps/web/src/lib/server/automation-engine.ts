import { prisma } from './db';

export const TRIGGER_KEYS = [
  'lead.created',
  'lead.stage_changed',
  'client.health_declined',
  'task.overdue',
  'invoice.overdue',
] as const;

export type TriggerKey = (typeof TRIGGER_KEYS)[number];

export const TRIGGER_FIELDS: Record<TriggerKey, string[]> = {
  'lead.created': ['name', 'status', 'temperature', 'source', 'estimatedValue', 'score'],
  'lead.stage_changed': ['name', 'status', 'temperature', 'source', 'estimatedValue', 'score'],
  'client.health_declined': ['name', 'status', 'healthScore', 'industry'],
  'task.overdue': ['title', 'status', 'priority'],
  'invoice.overdue': ['number', 'status', 'total', 'amountPaid'],
};

/**
 * Finds one real, currently-matching record for a trigger key — what a
 * dry-run evaluates conditions against. Returns null rather than a fake
 * record when nothing qualifies, since a simulation against invented data
 * would not be trustworthy.
 */
export async function sampleRecordFor(triggerKey: string): Promise<Record<string, unknown> | null> {
  switch (triggerKey) {
    case 'lead.created':
    case 'lead.stage_changed': {
      const lead = await prisma.lead.findFirst({ orderBy: { createdAt: 'desc' } });
      if (!lead) return null;
      return {
        id: lead.id,
        name: lead.name,
        status: lead.status,
        temperature: lead.temperature,
        source: lead.source,
        estimatedValue: Number(lead.estimatedValue),
        score: lead.score,
      };
    }
    case 'client.health_declined': {
      const client = await prisma.client.findFirst({ orderBy: { healthScore: 'asc' } });
      if (!client) return null;
      return {
        id: client.id,
        name: client.name,
        status: client.status,
        healthScore: client.healthScore,
        industry: client.industry,
      };
    }
    case 'task.overdue': {
      const task = await prisma.task.findFirst({
        where: { dueDate: { lt: new Date() }, status: { notIn: ['DONE', 'CANCELLED'] } },
        orderBy: { dueDate: 'asc' },
      });
      if (!task) return null;
      return { id: task.id, title: task.title, status: task.status, priority: task.priority };
    }
    case 'invoice.overdue': {
      const invoice = await prisma.invoice.findFirst({
        where: { status: { notIn: ['PAID', 'CANCELLED', 'DRAFT', 'REFUNDED'] }, dueDate: { lt: new Date() } },
        orderBy: { dueDate: 'asc' },
      });
      if (!invoice) return null;
      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
      };
    }
    default:
      return null;
  }
}

export interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: unknown;
}

export function evaluateCondition(record: Record<string, unknown>, condition: Condition): boolean {
  const actual = record[condition.field];

  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'gt':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
    case 'gte':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value;
    case 'lt':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value;
    case 'lte':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
    case 'contains':
      return typeof actual === 'string' && typeof condition.value === 'string' && actual.includes(condition.value);
    default:
      return false;
  }
}

export interface RuleAction {
  type: 'CREATE_NOTIFICATION' | 'CREATE_TASK' | 'UPDATE_FIELD';
  params: Record<string, unknown>;
}

/** A human-readable description of what an action would do — dry-run output only, never executed. */
export function describeAction(action: RuleAction, record: Record<string, unknown>): string {
  const recordLabel = String(record.name ?? record.title ?? record.number ?? record.id ?? 'the record');

  switch (action.type) {
    case 'CREATE_NOTIFICATION':
      return `Would notify with: "${String(action.params.message ?? '(no message set)')}" about ${recordLabel}`;
    case 'CREATE_TASK':
      return `Would create a task titled "${String(action.params.title ?? '(no title set)')}" linked to ${recordLabel}`;
    case 'UPDATE_FIELD':
      return `Would set ${String(action.params.field ?? '?')} = ${JSON.stringify(action.params.value)} on ${recordLabel}`;
    default:
      return 'Unknown action type';
  }
}
