import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function AnalyticsPage() {
  return (
    <PhasePlaceholder
      title="Analytics"
      phase={2}
      summary="Snapshot-backed reporting across revenue, cohorts, retention and forecasting."
      capabilities={[
        'Revenue by client, service, employee and source',
        'CAC, LTV, retention and cohort analysis',
        'Snapshot rollup jobs so dashboards never aggregate hot tables',
        'Saved custom queries and scheduled report delivery',
      ]}
    />
  );
}
