import { LeadSource, LeadStatus, Temperature } from '@ayv/types';

export interface ScorableLead {
  source: string;
  status: string;
  estimatedValue: number;
  industry: string | null;
  services: string[];
  email: string | null;
  phone: string | null;
  contactName: string | null;
  createdAt: Date;
  lastActivityAt: Date | null;
  activityCount: number;
}

export interface LeadScoreResult {
  score: number;
  temperature: Temperature;
  closeProbability: number;
  factors: { label: string; points: number; detail: string }[];
}

/**
 * Deterministic lead scoring.
 *
 * This is the heuristic baseline the Sales Agent's model-driven score is
 * measured against in Phase 4. Keeping it explicit and rule-based means a
 * salesperson can always be told *why* a lead scored what it did — which is
 * what makes the number trusted enough to act on.
 */

const SOURCE_POINTS: Record<string, number> = {
  [LeadSource.REFERRAL]: 25,
  [LeadSource.WEBSITE]: 18,
  [LeadSource.META]: 15,
  [LeadSource.GOOGLE]: 15,
  [LeadSource.LINKEDIN]: 14,
  [LeadSource.WALK_IN]: 20,
  [LeadSource.WHATSAPP]: 12,
  [LeadSource.MANUAL]: 10,
  [LeadSource.IMPORT]: 5,
};

const STAGE_POINTS: Record<string, number> = {
  [LeadStatus.NEW]: 0,
  [LeadStatus.CONTACTED]: 6,
  [LeadStatus.QUALIFIED]: 14,
  [LeadStatus.PROPOSAL]: 22,
  [LeadStatus.NEGOTIATION]: 28,
  [LeadStatus.WON]: 30,
  [LeadStatus.LOST]: 0,
  [LeadStatus.ON_HOLD]: 4,
};

/** Rough close rates by stage, used as the base for probability. */
const STAGE_BASE_PROBABILITY: Record<string, number> = {
  [LeadStatus.NEW]: 0.05,
  [LeadStatus.CONTACTED]: 0.12,
  [LeadStatus.QUALIFIED]: 0.28,
  [LeadStatus.PROPOSAL]: 0.45,
  [LeadStatus.NEGOTIATION]: 0.65,
  [LeadStatus.WON]: 1,
  [LeadStatus.LOST]: 0,
  [LeadStatus.ON_HOLD]: 0.1,
};

export function scoreLead(lead: ScorableLead): LeadScoreResult {
  const factors: LeadScoreResult['factors'] = [];
  let score = 0;

  // Source quality — referrals convert best, bulk imports worst.
  const sourcePoints = SOURCE_POINTS[lead.source] ?? 10;
  score += sourcePoints;
  factors.push({
    label: 'Source',
    points: sourcePoints,
    detail: `${lead.source.toLowerCase().replace(/_/g, ' ')} leads`,
  });

  // Pipeline progress.
  const stagePoints = STAGE_POINTS[lead.status] ?? 0;
  score += stagePoints;
  factors.push({ label: 'Stage', points: stagePoints, detail: lead.status });

  // Deal size, banded rather than linear so one large number cannot dominate.
  const value = lead.estimatedValue;
  const valuePoints = value >= 500_000 ? 20 : value >= 250_000 ? 16 : value >= 100_000 ? 12 : value >= 50_000 ? 8 : value > 0 ? 4 : 0;
  score += valuePoints;
  factors.push({
    label: 'Deal size',
    points: valuePoints,
    detail: value > 0 ? `₹${value.toLocaleString('en-IN')}` : 'not estimated',
  });

  // Contactability — a lead with no way to reach them is worth little.
  const contactPoints =
    (lead.email ? 5 : 0) + (lead.phone ? 7 : 0) + (lead.contactName ? 3 : 0);
  score += contactPoints;
  factors.push({
    label: 'Contact detail',
    points: contactPoints,
    detail: [lead.phone && 'phone', lead.email && 'email', lead.contactName && 'name']
      .filter(Boolean)
      .join(', ') || 'incomplete',
  });

  // Multi-service interest signals a larger, stickier engagement.
  const servicePoints = Math.min(lead.services.length * 3, 9);
  score += servicePoints;
  factors.push({
    label: 'Service interest',
    points: servicePoints,
    detail: `${lead.services.length} service${lead.services.length === 1 ? '' : 's'}`,
  });

  // Engagement.
  const engagementPoints = Math.min(lead.activityCount * 2, 10);
  score += engagementPoints;
  factors.push({
    label: 'Engagement',
    points: engagementPoints,
    detail: `${lead.activityCount} logged interaction${lead.activityCount === 1 ? '' : 's'}`,
  });

  // Recency decay — silence is the strongest negative signal in a pipeline.
  const referenceDate = lead.lastActivityAt ?? lead.createdAt;
  const daysSilent = Math.floor((Date.now() - referenceDate.getTime()) / 86_400_000);
  const decay = daysSilent > 30 ? -20 : daysSilent > 14 ? -12 : daysSilent > 7 ? -6 : 0;
  score += decay;
  if (decay !== 0) {
    factors.push({ label: 'Recency', points: decay, detail: `${daysSilent} days without contact` });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Probability blends the stage base rate with how strong the lead looks
  // relative to a neutral 50-point score.
  const base = STAGE_BASE_PROBABILITY[lead.status] ?? 0.1;
  const modifier = 1 + (finalScore - 50) / 125;
  const closeProbability =
    lead.status === LeadStatus.WON
      ? 1
      : lead.status === LeadStatus.LOST
        ? 0
        : Math.max(0.01, Math.min(0.95, Number((base * modifier).toFixed(3))));

  return {
    score: finalScore,
    temperature: finalScore >= 70 ? Temperature.HOT : finalScore >= 45 ? Temperature.WARM : Temperature.COLD,
    closeProbability,
    factors,
  };
}
