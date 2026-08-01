import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function AiCenterPage() {
  return (
    <PhasePlaceholder
      title="AI Command Center"
      phase={4}
      summary="Eleven agents with memory, tools and permissions — monitored like employees."
      capabilities={[
        'Agent roster with autonomy levels: suggest, act-with-approval, act',
        'Every tool call passes the same permission guard a human request does',
        'pgvector memory with a correction-based learning loop',
        'Approval queue for anything touching money, contracts or clients',
        'Per-agent acceptance rate, cost and time-saved metrics',
      ]}
    />
  );
}
