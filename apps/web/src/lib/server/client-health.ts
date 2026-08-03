/**
 * Client health scoring.
 *
 * Weights mirror docs/06-automation-workflows.md §5. Every signal returns a
 * 0–100 sub-score plus a human-readable explanation, because a health number
 * nobody can interrogate is a number nobody acts on.
 */

export interface HealthInputs {
  /** Days late, per paid invoice. Negative means paid early. */
  paymentDelays: number[];
  overdueInvoiceCount: number;
  /** Median hours to respond to a message from us. */
  medianResponseHours: number | null;
  /** Median hours to decide on a submitted deliverable. */
  medianApprovalHours: number | null;
  projectsDelivered: number;
  projectsDeliveredOnTime: number;
  /** Rolling CSAT responses, 1–5. */
  satisfactionRatings: number[];
  openTicketCount: number;
  oldestOpenTicketDays: number;
  /** Portal logins in the last 30 days. */
  recentLogins: number;
}

export interface HealthSignal {
  key: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface HealthResult {
  score: number;
  signals: HealthSignal[];
  band: 'CRITICAL' | 'AT_RISK' | 'STABLE' | 'HEALTHY';
}

const WEIGHTS = {
  payment: 0.25,
  communication: 0.2,
  approval: 0.15,
  delivery: 0.15,
  satisfaction: 0.15,
  support: 0.05,
  engagement: 0.05,
} as const;

/** Linear interpolation that clamps at both ends. */
function band(value: number, best: number, worst: number): number {
  if (worst === best) return 100;
  const ratio = (value - best) / (worst - best);
  return Math.round(Math.max(0, Math.min(1, 1 - ratio)) * 100);
}

export function computeClientHealth(inputs: HealthInputs): HealthResult {
  const signals: HealthSignal[] = [];

  // Payment behaviour — the strongest single predictor of a healthy account.
  const averageDelay =
    inputs.paymentDelays.length > 0
      ? inputs.paymentDelays.reduce((sum, days) => sum + days, 0) / inputs.paymentDelays.length
      : 0;
  let paymentScore =
    averageDelay <= 0 ? 100 : averageDelay <= 7 ? 70 : averageDelay <= 30 ? 40 : 10;
  paymentScore = Math.max(0, paymentScore - inputs.overdueInvoiceCount * 10);
  signals.push({
    key: 'payment',
    label: 'Payment behaviour',
    weight: WEIGHTS.payment,
    score: paymentScore,
    detail:
      inputs.paymentDelays.length === 0
        ? 'No payment history yet'
        : `Average ${Math.round(averageDelay)} days from due date` +
          (inputs.overdueInvoiceCount > 0
            ? `, ${inputs.overdueInvoiceCount} invoice(s) currently overdue`
            : ''),
  });

  // Communication responsiveness.
  const communicationScore =
    inputs.medianResponseHours === null ? 70 : band(inputs.medianResponseHours, 4, 72);
  signals.push({
    key: 'communication',
    label: 'Communication',
    weight: WEIGHTS.communication,
    score: communicationScore,
    detail:
      inputs.medianResponseHours === null
        ? 'Not enough data'
        : `Typically responds in ${Math.round(inputs.medianResponseHours)}h`,
  });

  // Approval speed — slow approvals stall production and erode margin.
  const approvalScore =
    inputs.medianApprovalHours === null ? 70 : band(inputs.medianApprovalHours, 24, 168);
  signals.push({
    key: 'approval',
    label: 'Approval speed',
    weight: WEIGHTS.approval,
    score: approvalScore,
    detail:
      inputs.medianApprovalHours === null
        ? 'No approvals yet'
        : `Median ${Math.round(inputs.medianApprovalHours)}h to decide`,
  });

  // Our own delivery record for this client.
  const deliveryScore =
    inputs.projectsDelivered === 0
      ? 75
      : Math.round((inputs.projectsDeliveredOnTime / inputs.projectsDelivered) * 100);
  signals.push({
    key: 'delivery',
    label: 'Delivery performance',
    weight: WEIGHTS.delivery,
    score: deliveryScore,
    detail:
      inputs.projectsDelivered === 0
        ? 'No completed projects yet'
        : `${inputs.projectsDeliveredOnTime}/${inputs.projectsDelivered} delivered on time`,
  });

  // Satisfaction.
  const averageRating =
    inputs.satisfactionRatings.length > 0
      ? inputs.satisfactionRatings.reduce((sum, rating) => sum + rating, 0) /
        inputs.satisfactionRatings.length
      : null;
  const satisfactionScore =
    averageRating === null ? 70 : Math.round(((averageRating - 1) / 4) * 100);
  signals.push({
    key: 'satisfaction',
    label: 'Satisfaction',
    weight: WEIGHTS.satisfaction,
    score: satisfactionScore,
    detail:
      averageRating === null
        ? 'No feedback collected'
        : `${averageRating.toFixed(1)}/5 across ${inputs.satisfactionRatings.length} response(s)`,
  });

  // Support load — many or old open tickets signal friction.
  const supportScore = Math.max(
    0,
    100 - inputs.openTicketCount * 15 - Math.floor(inputs.oldestOpenTicketDays / 7) * 10,
  );
  signals.push({
    key: 'support',
    label: 'Support load',
    weight: WEIGHTS.support,
    score: supportScore,
    detail:
      inputs.openTicketCount === 0
        ? 'No open tickets'
        : `${inputs.openTicketCount} open, oldest ${inputs.oldestOpenTicketDays} days`,
  });

  // Engagement with the portal.
  const engagementScore = Math.min(100, inputs.recentLogins * 20);
  signals.push({
    key: 'engagement',
    label: 'Engagement',
    weight: WEIGHTS.engagement,
    score: engagementScore,
    detail: `${inputs.recentLogins} portal visit(s) in 30 days`,
  });

  const score = Math.round(
    signals.reduce((total, signal) => total + signal.score * signal.weight, 0),
  );

  return {
    score,
    signals,
    band: score < 40 ? 'CRITICAL' : score < 60 ? 'AT_RISK' : score < 80 ? 'STABLE' : 'HEALTHY',
  };
}
