/** API-facing entity shapes. These are what controllers return, not raw DB rows. */

import type {
  ActivityType,
  AlertSeverity,
  ClientStatus,
  Industry,
  LeadSource,
  LeadStatus,
  Priority,
  ProjectStatus,
  RoleKey,
  ServiceType,
  TaskStatus,
  Temperature,
  UserStatus,
  UserType,
} from './enums';
import type { Permission } from './permissions';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
}

export interface AuthUser extends UserSummary {
  userType: UserType;
  status: UserStatus;
  organizationId: string;
  clientId: string | null;
  role: { id: string; key: RoleKey; name: string };
  permissions: Permission[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface Lead {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  temperature: Temperature;
  industry: Industry | null;
  services: ServiceType[];
  estimatedValue: number;
  currency: string;
  score: number;
  /** AI-estimated probability of closing, 0–1. Null until first scoring run. */
  closeProbability: number | null;
  notes: string | null;
  lostReason: string | null;
  owner: UserSummary | null;
  convertedClientId: string | null;
  stageChangedAt: string;
  /** Whole days the lead has sat in its current stage. */
  daysInStage: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  body: string | null;
  outcome: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  actor: UserSummary | null;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  legalName: string | null;
  industry: Industry | null;
  status: ClientStatus;
  healthScore: number;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  services: ServiceType[];
  accountManager: UserSummary | null;
  monthlyRetainer: number | null;
  currency: string;
  contractStartDate: string | null;
  renewalDate: string | null;
  createdAt: string;
}

export interface HealthBreakdown {
  score: number;
  signals: {
    key: string;
    label: string;
    weight: number;
    score: number;
    detail: string;
  }[];
  computedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  services: ServiceType[];
  client: Pick<Client, 'id' | 'name'> | null;
  manager: UserSummary | null;
  members: UserSummary[];
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progress: number;
  taskCounts: Record<TaskStatus, number>;
  /** Redacted for roles without finance visibility. */
  budget: number | null;
  internalCost: number | null;
  margin: number | null;
  currency: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  projectId: string;
  projectName: string | null;
  assignee: UserSummary | null;
  dueDate: string | null;
  estimatedHours: number | null;
  loggedHours: number;
  position: number;
  labels: string[];
  clientVisible: boolean;
  isBlocked: boolean;
  isOverdue: boolean;
  subtaskCount: number;
  completedSubtaskCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface MetricValue {
  value: number;
  change: number | null;
  trend: { label: string; value: number }[];
}

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface AiInsight {
  id: string;
  type: 'OPPORTUNITY' | 'RISK' | 'OBSERVATION';
  message: string;
  confidence: number;
}

export interface ExecutiveDashboard {
  period: { from: string; to: string; label: string };
  revenue: MetricValue;
  profit: { value: number; margin: number; change: number | null };
  cash: { balance: number; runwayMonths: number | null };
  expenses: MetricValue;
  pipeline: { value: number; deals: number; forecast: number };
  receivables: { total: number; overdue: number; overdueCount: number };
  mrr: number;
  arr: number;
  funnel: { stage: LeadStatus; count: number; value: number }[];
  conversionRate: number;
  clientHealth: { healthy: number; atRisk: number; critical: number; average: number };
  productivity: { utilisation: number; onTimeRate: number; tasksPerDay: number };
  tasksDueToday: number;
  upcomingRenewals: { clientId: string; clientName: string; date: string; value: number }[];
  alerts: DashboardAlert[];
  aiInsights: AiInsight[];
}

export interface SalesDashboard {
  period: { from: string; to: string; label: string };
  target: number;
  achieved: number;
  achievementRate: number;
  pipelineValue: number;
  openDeals: number;
  callsLogged: number;
  meetingsHeld: number;
  followUpsDue: number;
  averageDealSize: number;
  averageLeadAge: number;
  leaderboard: { user: UserSummary; won: number; value: number; conversionRate: number }[];
  bySource: { source: LeadSource; count: number; value: number; conversionRate: number }[];
}
