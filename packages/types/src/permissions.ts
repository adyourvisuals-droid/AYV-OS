/**
 * The permission registry.
 *
 * A permission is `resource:action`. Scope (`ALL` / `TEAM` / `OWN`) is attached
 * when the permission is granted to a role, not baked into the string — that
 * keeps the registry small and the role matrix expressive.
 */

export const PERMISSIONS = {
  // ─── Core ────────────────────────────────────────────────────────────────
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  SETTING_READ: 'setting:read',
  SETTING_UPDATE: 'setting:update',
  CUSTOM_FIELD_MANAGE: 'setting:custom_field:manage',

  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_RESTORE: 'user:restore',

  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  TEAM_READ: 'team:read',
  TEAM_MANAGE: 'team:manage',

  AUDIT_READ: 'audit:read',

  // ─── CRM ─────────────────────────────────────────────────────────────────
  LEAD_READ: 'crm:lead:read',
  LEAD_CREATE: 'crm:lead:create',
  LEAD_UPDATE: 'crm:lead:update',
  LEAD_DELETE: 'crm:lead:delete',
  LEAD_RESTORE: 'crm:lead:restore',
  LEAD_ASSIGN: 'crm:lead:assign',
  LEAD_CONVERT: 'crm:lead:convert',
  LEAD_EXPORT: 'crm:lead:export',

  PIPELINE_READ: 'crm:pipeline:read',
  PIPELINE_MANAGE: 'crm:pipeline:manage',

  QUOTATION_READ: 'crm:quotation:read',
  QUOTATION_CREATE: 'crm:quotation:create',
  QUOTATION_UPDATE: 'crm:quotation:update',
  QUOTATION_APPROVE: 'crm:quotation:approve',

  PROPOSAL_READ: 'crm:proposal:read',
  PROPOSAL_CREATE: 'crm:proposal:create',
  PROPOSAL_APPROVE: 'crm:proposal:approve',

  CONTRACT_READ: 'crm:contract:read',
  CONTRACT_CREATE: 'crm:contract:create',
  CONTRACT_APPROVE: 'crm:contract:approve',

  PACKAGE_READ: 'agency:package:read',
  PACKAGE_MANAGE: 'agency:package:manage',
  RETAINER_READ: 'agency:retainer:read',
  RETAINER_MANAGE: 'agency:retainer:manage',
  CAPI_MANAGE: 'agency:capi:manage',

  // ─── Team communication ──────────────────────────────────────────────────
  COMM_USE: 'comms:use',
  ANNOUNCEMENT_MANAGE: 'comms:announcement:manage',

  ACTIVITY_READ: 'crm:activity:read',
  ACTIVITY_CREATE: 'crm:activity:create',

  // ─── Clients ─────────────────────────────────────────────────────────────
  CLIENT_READ: 'client:read',
  CLIENT_CREATE: 'client:create',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',
  CLIENT_HEALTH_READ: 'client:health:read',
  TICKET_READ: 'client:ticket:read',
  TICKET_MANAGE: 'client:ticket:manage',

  // ─── Projects ────────────────────────────────────────────────────────────
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_RESTORE: 'project:restore',

  TASK_READ: 'task:read',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',

  TIMELOG_READ: 'timelog:read',
  TIMELOG_CREATE: 'timelog:create',

  // ─── Creative ────────────────────────────────────────────────────────────
  CREATIVE_READ: 'creative:read',
  CREATIVE_CREATE: 'creative:create',
  CREATIVE_UPDATE: 'creative:update',
  APPROVAL_READ: 'creative:approval:read',
  APPROVAL_DECIDE: 'creative:approval:decide',

  // ─── HRM ─────────────────────────────────────────────────────────────────
  EMPLOYEE_READ: 'hrm:employee:read',
  EMPLOYEE_MANAGE: 'hrm:employee:manage',
  ATTENDANCE_READ: 'hrm:attendance:read',
  ATTENDANCE_MANAGE: 'hrm:attendance:manage',
  LEAVE_READ: 'hrm:leave:read',
  LEAVE_CREATE: 'hrm:leave:create',
  LEAVE_APPROVE: 'hrm:leave:approve',
  PAYROLL_READ: 'hrm:payroll:read',
  PAYROLL_MANAGE: 'hrm:payroll:manage',
  PERFORMANCE_READ: 'hrm:performance:read',
  PERFORMANCE_MANAGE: 'hrm:performance:manage',
  CANDIDATE_READ: 'hrm:candidate:read',
  CANDIDATE_MANAGE: 'hrm:candidate:manage',

  // ─── Finance ─────────────────────────────────────────────────────────────
  INVOICE_READ: 'finance:invoice:read',
  INVOICE_CREATE: 'finance:invoice:create',
  INVOICE_UPDATE: 'finance:invoice:update',
  INVOICE_APPROVE: 'finance:invoice:approve',
  PAYMENT_READ: 'finance:payment:read',
  PAYMENT_MANAGE: 'finance:payment:manage',
  EXPENSE_READ: 'finance:expense:read',
  EXPENSE_CREATE: 'finance:expense:create',
  EXPENSE_APPROVE: 'finance:expense:approve',
  VENDOR_MANAGE: 'finance:vendor:manage',
  PNL_READ: 'finance:pnl:read',
  BUDGET_MANAGE: 'finance:budget:manage',
  LEDGER_READ: 'finance:ledger:read',
  LEDGER_MANAGE: 'finance:ledger:manage',

  // ─── Operations ──────────────────────────────────────────────────────────
  SOP_READ: 'ops:sop:read',
  SOP_MANAGE: 'ops:sop:manage',
  AUTOMATION_READ: 'ops:automation:read',
  AUTOMATION_MANAGE: 'ops:automation:manage',

  // ─── Content ─────────────────────────────────────────────────────────────
  ASSET_READ: 'asset:read',
  ASSET_CREATE: 'asset:create',
  ASSET_DELETE: 'asset:delete',
  KNOWLEDGE_READ: 'knowledge:read',
  KNOWLEDGE_MANAGE: 'knowledge:manage',
  POST_READ: 'social:post:read',
  POST_MANAGE: 'social:post:manage',
  POST_PUBLISH: 'social:post:publish',
  CAMPAIGN_READ: 'social:campaign:read',
  CAMPAIGN_MANAGE: 'social:campaign:manage',
  SHOOT_READ: 'creative:shoot:read',
  SHOOT_MANAGE: 'creative:shoot:manage',
  CREDENTIAL_READ: 'client:credential:read',
  CREDENTIAL_MANAGE: 'client:credential:manage',

  // ─── AI ──────────────────────────────────────────────────────────────────
  AI_USE: 'ai:agent:use',
  AI_CONFIGURE: 'ai:agent:configure',
  AI_APPROVE: 'ai:approval:decide',

  // ─── Analytics ───────────────────────────────────────────────────────────
  DASHBOARD_READ: 'analytics:dashboard:read',
  DASHBOARD_EXECUTIVE: 'analytics:dashboard:executive',
  REPORT_READ: 'analytics:report:read',
  REPORT_EXPORT: 'analytics:report:export',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/** Group permissions by their `resource` segment, for the role editor UI. */
export function groupPermissions(permissions: Permission[] = ALL_PERMISSIONS) {
  return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    const domain = permission.split(':')[0];
    (acc[domain] ??= []).push(permission);
    return acc;
  }, {});
}
