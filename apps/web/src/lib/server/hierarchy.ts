import { prisma } from './db';
import type { AuthPrincipal } from './auth';

/**
 * Reporting hierarchy and privilege guardrails.
 *
 * Seniority is expressed by Role.level, where lower is more senior
 * (SUPER_ADMIN is 0, INTERN is 90). The reporting line is User.managerId.
 * Both existed in the schema from the start but nothing enforced or
 * populated them, so an organisation had roles without a chain of command.
 */

/** Nobody may grant a role at or above their own seniority. */
export function canAssignRoleLevel(principal: AuthPrincipal, targetLevel: number): boolean {
  // Level 0 is the unrestricted role; it is the only one that can mint a peer.
  if (principal.roleLevel === 0) return true;
  return targetLevel > principal.roleLevel;
}

/**
 * Every user below `userId` in the reporting tree, plus the user themselves.
 *
 * Walks the tree breadth-first rather than recursing in SQL: an
 * organisation's management chain is shallow, and this keeps the query
 * count bounded by depth instead of by headcount. Cycles cannot occur
 * because assignManagerGuard rejects them, but `seen` makes this safe
 * regardless of how the data got there.
 */
export async function reportingTreeIds(userId: string): Promise<string[]> {
  const seen = new Set<string>([userId]);
  let frontier = [userId];

  while (frontier.length > 0) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });

    frontier = [];
    for (const report of reports) {
      if (seen.has(report.id)) continue;
      seen.add(report.id);
      frontier.push(report.id);
    }
  }

  return [...seen];
}

/**
 * The set of people a principal may hand work to, given the scope attached
 * to their assignment permission.
 *
 *   ALL  — anyone in the organisation
 *   TEAM — their own team, plus everyone beneath them in the reporting tree
 *   OWN  — only themselves
 *
 * Returns null for the unrestricted case so callers can skip building a
 * potentially large id list when no restriction applies.
 */
export async function assignableUserIds(
  principal: AuthPrincipal,
  scope: 'ALL' | 'TEAM' | 'OWN',
): Promise<string[] | null> {
  if (scope === 'ALL') return null;
  if (scope === 'OWN') return [principal.userId];

  const ids = new Set(await reportingTreeIds(principal.userId));

  if (principal.teamId) {
    const teammates = await prisma.user.findMany({
      where: { teamId: principal.teamId },
      select: { id: true },
    });
    for (const teammate of teammates) ids.add(teammate.id);
  }

  return [...ids];
}

/**
 * Rejects a manager assignment that would create a loop.
 *
 * A cycle would make reportingTreeIds and any "who does this person report
 * to" walk non-terminating, so it is refused at the point of write rather
 * than defended against everywhere it is read.
 */
export async function managerWouldCycle(userId: string, managerId: string): Promise<boolean> {
  if (userId === managerId) return true;

  const seen = new Set<string>();
  let current: string | null = managerId;

  while (current) {
    if (current === userId) return true;
    if (seen.has(current)) return false;
    seen.add(current);

    const next: { managerId: string | null } | null = await prisma.user.findFirst({
      where: { id: current },
      select: { managerId: true },
    });
    current = next?.managerId ?? null;
  }

  return false;
}
