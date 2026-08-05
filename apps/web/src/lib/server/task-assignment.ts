import { PERMISSIONS } from '@ayv/types';

import type { AuthPrincipal } from './auth';
import { prisma } from './db';
import { assignableUserIds } from './hierarchy';
import { errorResponse } from './http';
import { scopeOf } from './scope';

/**
 * Decides whether a principal may allot work to a given user.
 *
 * Returns an error response to hand straight back to the client, or null
 * when the assignment is permitted. Shared by task creation and reassignment
 * so both enforce the same rule.
 */
export async function assignmentDenial(principal: AuthPrincipal, assigneeId: string) {
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, status: { not: 'OFFBOARDED' } },
    select: { id: true },
  });
  if (!assignee) return errorResponse(404, 'NOT_FOUND', 'Assignee not found');

  // Picking up work yourself is always allowed. TASK_ASSIGN governs putting
  // work onto somebody else.
  if (assigneeId === principal.userId) return null;

  if (!principal.permissions.includes(PERMISSIONS.TASK_ASSIGN)) {
    return errorResponse(403, 'INSUFFICIENT_PERMISSION', 'You can only assign tasks to yourself');
  }

  const allowed = await assignableUserIds(principal, scopeOf(principal, PERMISSIONS.TASK_ASSIGN));

  if (allowed !== null && !allowed.includes(assigneeId)) {
    return errorResponse(
      403,
      'INSUFFICIENT_PERMISSION',
      'You can only assign work to your own team or to people who report to you',
    );
  }

  return null;
}
