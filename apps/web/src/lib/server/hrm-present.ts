import { PERMISSIONS } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';
import { scopeFilter } from './scope';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  designation: true,
  department: true,
  status: true,
  joinedAt: true,
  roleId: true,
  role: { select: { id: true, key: true, name: true } },
  managerId: true,
  manager: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

type EmployeeRow = Prisma.UserGetPayload<{ select: typeof EMPLOYEE_SELECT }>;

export function presentEmployee(user: EmployeeRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    initials: initials(user.name),
    designation: user.designation,
    department: user.department,
    status: user.status,
    joinedAt: user.joinedAt?.toISOString() ?? null,
    role: user.role,
    manager: user.manager,
  };
}

export function attendanceVisibilityFilter(principal: AuthPrincipal): Record<string, unknown> {
  return scopeFilter(principal, PERMISSIONS.ATTENDANCE_READ, { ownerField: 'userId' });
}

export function leaveVisibilityFilter(principal: AuthPrincipal): Record<string, unknown> {
  return scopeFilter(principal, PERMISSIONS.LEAVE_READ, { ownerField: 'userId' });
}

export const ATTENDANCE_INCLUDE = {
  user: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.AttendanceInclude;

type AttendanceRow = Prisma.AttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

export function presentAttendance(row: AttendanceRow) {
  return {
    id: row.id,
    user: row.user,
    date: row.date.toISOString(),
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    status: row.status,
    workMinutes: row.workMinutes,
    lateMinutes: row.lateMinutes,
  };
}

export const LEAVE_INCLUDE = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  approver: { select: { id: true, name: true } },
} satisfies Prisma.LeaveInclude;

type LeaveRow = Prisma.LeaveGetPayload<{ include: typeof LEAVE_INCLUDE }>;

export function presentLeave(row: LeaveRow) {
  return {
    id: row.id,
    user: row.user,
    type: row.type,
    status: row.status,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    days: Number(row.days),
    reason: row.reason,
    approver: row.approver,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Counts only days that fall on the organisation's configured working days. */
export function countWorkingDays(start: Date, end: Date, workingDays: number[]): number {
  const days = new Set(workingDays);
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= last.getTime()) {
    if (days.has(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/** Standard annual entitlements used to lazily seed a user's first LeaveBalance rows. */
export const DEFAULT_LEAVE_ENTITLEMENTS: { type: string; entitled: number }[] = [
  { type: 'CASUAL', entitled: 12 },
  { type: 'SICK', entitled: 8 },
  { type: 'EARNED', entitled: 15 },
];
