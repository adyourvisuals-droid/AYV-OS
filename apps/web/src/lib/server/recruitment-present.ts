import type { Prisma } from '../../../generated/prisma';

export const JOB_OPENING_INCLUDE = {
  _count: { select: { candidates: true } },
} satisfies Prisma.JobOpeningInclude;

type JobOpeningWithCounts = Prisma.JobOpeningGetPayload<{ include: typeof JOB_OPENING_INCLUDE }>;

export function presentJobOpening(opening: JobOpeningWithCounts) {
  return {
    id: opening.id,
    title: opening.title,
    department: opening.department,
    description: opening.description,
    location: opening.location,
    employmentType: opening.employmentType,
    status: opening.status,
    openings: opening.openings,
    candidateCount: opening._count.candidates,
    createdAt: opening.createdAt.toISOString(),
  };
}

export const CANDIDATE_INCLUDE = {
  jobOpening: { select: { id: true, title: true } },
} satisfies Prisma.CandidateInclude;

type CandidateWithJob = Prisma.CandidateGetPayload<{ include: typeof CANDIDATE_INCLUDE }>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function presentCandidate(candidate: CandidateWithJob) {
  return {
    id: candidate.id,
    name: candidate.name,
    initials: initials(candidate.name),
    email: candidate.email,
    phone: candidate.phone,
    resumeUrl: candidate.resumeUrl,
    stage: candidate.stage,
    score: candidate.score,
    screeningNotes: candidate.screeningNotes,
    rejectionReason: candidate.rejectionReason,
    jobOpening: candidate.jobOpening,
    createdAt: candidate.createdAt.toISOString(),
  };
}

export const CANDIDATE_STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'ASSIGNMENT',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;
