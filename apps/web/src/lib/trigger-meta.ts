/**
 * Client-safe mirror of apps/web/src/lib/server/automation-engine.ts's
 * TRIGGER_KEYS/TRIGGER_FIELDS — kept in the client bundle (not imported from
 * the server file, which pulls in Prisma) purely as UI metadata for the
 * condition builder.
 */
export const TRIGGER_META = [
  { key: 'lead.created', label: 'Lead created', fields: ['name', 'status', 'temperature', 'source', 'estimatedValue', 'score'] },
  { key: 'lead.stage_changed', label: 'Lead stage changed', fields: ['name', 'status', 'temperature', 'source', 'estimatedValue', 'score'] },
  { key: 'client.health_declined', label: 'Client health declined', fields: ['name', 'status', 'healthScore', 'industry'] },
  { key: 'task.overdue', label: 'Task overdue', fields: ['title', 'status', 'priority'] },
  { key: 'invoice.overdue', label: 'Invoice overdue', fields: ['number', 'status', 'total', 'amountPaid'] },
] as const;

export const OPERATORS = [
  { key: 'eq', label: 'equals' },
  { key: 'neq', label: 'not equals' },
  { key: 'gt', label: 'greater than' },
  { key: 'gte', label: 'greater or equal' },
  { key: 'lt', label: 'less than' },
  { key: 'lte', label: 'less or equal' },
  { key: 'contains', label: 'contains' },
] as const;

export const ACTION_TYPES = [
  { key: 'CREATE_NOTIFICATION', label: 'Send a notification' },
  { key: 'CREATE_TASK', label: 'Create a task' },
  { key: 'UPDATE_FIELD', label: 'Update a field' },
] as const;
