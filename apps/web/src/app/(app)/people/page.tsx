import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function PeoplePage() {
  return (
    <PhasePlaceholder
      title="People"
      phase={2}
      summary="Attendance, leave, payroll, performance and hiring."
      capabilities={[
        'Attendance with check-in windows and late tracking',
        'Leave requests with balances and manager approval',
        'Payroll generation from attendance, with payslips',
        'Performance reviews built from real task and quality evidence',
        'Hiring pipeline with AI candidate screening against the job description',
      ]}
    />
  );
}
