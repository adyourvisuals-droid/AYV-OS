import { PERMISSIONS } from '@ayv/types';

import type { Prisma } from '../../../generated/prisma';

import type { AuthPrincipal } from './auth';
import { scopeFilter } from './scope';

export const BRIEF_INCLUDE = {
  client: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, code: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { submissions: true } },
} satisfies Prisma.CreativeBriefInclude;

type BriefRow = Prisma.CreativeBriefGetPayload<{ include: typeof BRIEF_INCLUDE }>;

export function briefVisibilityFilter(principal: AuthPrincipal): Prisma.CreativeBriefWhereInput {
  return scopeFilter(principal, PERMISSIONS.CREATIVE_READ, {
    ownerField: 'assigneeId',
  }) as Prisma.CreativeBriefWhereInput;
}

export function presentBrief(brief: BriefRow) {
  return {
    id: brief.id,
    title: brief.title,
    type: brief.type,
    brief: brief.brief,
    status: brief.status,
    priority: brief.priority,
    client: brief.client,
    project: brief.project,
    assignee: brief.assignee,
    dueDate: brief.dueDate?.toISOString() ?? null,
    submittedAt: brief.submittedAt?.toISOString() ?? null,
    deliveredAt: brief.deliveredAt?.toISOString() ?? null,
    revisionCount: brief.revisionCount,
    revisionLimit: brief.revisionLimit,
    isOverRevisionLimit: brief.revisionCount >= brief.revisionLimit,
    rating: brief.rating,
    turnaroundHours: brief.turnaroundHours,
    submissionCount: brief._count.submissions,
    createdAt: brief.createdAt.toISOString(),
  };
}

export const SUBMISSION_INCLUDE = {
  revisions: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.CreativeSubmissionInclude;

type SubmissionRow = Prisma.CreativeSubmissionGetPayload<{ include: typeof SUBMISSION_INCLUDE }>;

export function presentSubmission(submission: SubmissionRow) {
  return {
    id: submission.id,
    version: submission.version,
    fileUrl: submission.fileUrl,
    notes: submission.notes,
    createdAt: submission.createdAt.toISOString(),
    revisions: submission.revisions.map((revision) => ({
      id: revision.id,
      note: revision.note,
      fromClient: revision.fromClient,
      resolvedAt: revision.resolvedAt?.toISOString() ?? null,
      createdAt: revision.createdAt.toISOString(),
    })),
  };
}

export function presentApproval(approval: {
  id: string;
  status: string;
  isClientApproval: boolean;
  comment: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}) {
  return {
    id: approval.id,
    status: approval.status,
    isClientApproval: approval.isClientApproval,
    comment: approval.comment,
    requestedAt: approval.requestedAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString() ?? null,
  };
}
