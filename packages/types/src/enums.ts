/** Domain enumerations. Kept in lockstep with prisma/schema.prisma. */

export const UserType = {
  EMPLOYEE: 'EMPLOYEE',
  CLIENT: 'CLIENT',
  AI_AGENT: 'AI_AGENT',
} as const;
export type UserType = (typeof UserType)[keyof typeof UserType];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  SUSPENDED: 'SUSPENDED',
  OFFBOARDED: 'OFFBOARDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const RoleKey = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CEO: 'CEO',
  OPERATIONS_HEAD: 'OPERATIONS_HEAD',
  SALES_HEAD: 'SALES_HEAD',
  SALES_EXECUTIVE: 'SALES_EXECUTIVE',
  CREATIVE_HEAD: 'CREATIVE_HEAD',
  DESIGNER: 'DESIGNER',
  VIDEO_EDITOR: 'VIDEO_EDITOR',
  DEVELOPER: 'DEVELOPER',
  HR: 'HR',
  FINANCE: 'FINANCE',
  INTERN: 'INTERN',
  CLIENT: 'CLIENT',
} as const;
export type RoleKey = (typeof RoleKey)[keyof typeof RoleKey];

export const PermissionScope = {
  ALL: 'ALL',
  TEAM: 'TEAM',
  OWN: 'OWN',
} as const;
export type PermissionScope = (typeof PermissionScope)[keyof typeof PermissionScope];

export const LeadSource = {
  MANUAL: 'MANUAL',
  WEBSITE: 'WEBSITE',
  META: 'META',
  GOOGLE: 'GOOGLE',
  REFERRAL: 'REFERRAL',
  WHATSAPP: 'WHATSAPP',
  LINKEDIN: 'LINKEDIN',
  WALK_IN: 'WALK_IN',
  IMPORT: 'IMPORT',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  PROPOSAL: 'PROPOSAL',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  ON_HOLD: 'ON_HOLD',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

/** Ordered pipeline stages as they appear on the Kanban board, left to right. */
export const PIPELINE_STAGES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
];

export const Temperature = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD',
} as const;
export type Temperature = (typeof Temperature)[keyof typeof Temperature];

export const ServiceType = {
  BRANDING: 'BRANDING',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  PERFORMANCE_MARKETING: 'PERFORMANCE_MARKETING',
  META_ADS: 'META_ADS',
  GOOGLE_ADS: 'GOOGLE_ADS',
  WEBSITE: 'WEBSITE',
  VIDEO_EDITING: 'VIDEO_EDITING',
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  AI_CONTENT: 'AI_CONTENT',
  AI_VIDEO: 'AI_VIDEO',
  AUTOMATION: 'AUTOMATION',
  CONSULTING: 'CONSULTING',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const Industry = {
  REAL_ESTATE: 'REAL_ESTATE',
  HEALTHCARE: 'HEALTHCARE',
  EDUCATION: 'EDUCATION',
  AUTOMOBILE: 'AUTOMOBILE',
  RETAIL: 'RETAIL',
  PERSONAL_BRAND: 'PERSONAL_BRAND',
  HOSPITALITY: 'HOSPITALITY',
  FINANCE: 'FINANCE',
  TECHNOLOGY: 'TECHNOLOGY',
  OTHER: 'OTHER',
} as const;
export type Industry = (typeof Industry)[keyof typeof Industry];

export const ClientStatus = {
  ACTIVE: 'ACTIVE',
  ONBOARDING: 'ONBOARDING',
  PAUSED: 'PAUSED',
  CHURNED: 'CHURNED',
} as const;
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  REVIEW: 'REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  CLIENT_REVIEW: 'CLIENT_REVIEW',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** Ordered task columns as they appear on the project board. */
export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const CreativeType = {
  DESIGN: 'DESIGN',
  VIDEO: 'VIDEO',
  CONTENT: 'CONTENT',
  THUMBNAIL: 'THUMBNAIL',
  COPY: 'COPY',
  SCRIPT: 'SCRIPT',
  AI_CONTENT: 'AI_CONTENT',
} as const;
export type CreativeType = (typeof CreativeType)[keyof typeof CreativeType];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ActivityType = {
  NOTE: 'NOTE',
  CALL: 'CALL',
  MEETING: 'MEETING',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  STAGE_CHANGE: 'STAGE_CHANGE',
  ASSIGNMENT: 'ASSIGNMENT',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  QUOTATION_SENT: 'QUOTATION_SENT',
  CONTRACT_SENT: 'CONTRACT_SENT',
  SYSTEM: 'SYSTEM',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const AgentAutonomy = {
  SUGGEST: 'SUGGEST',
  ACT_WITH_APPROVAL: 'ACT_WITH_APPROVAL',
  ACT: 'ACT',
} as const;
export type AgentAutonomy = (typeof AgentAutonomy)[keyof typeof AgentAutonomy];

export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];
