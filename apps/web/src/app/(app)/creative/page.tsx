import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function CreativePage() {
  return (
    <PhasePlaceholder
      title="Creative Production"
      phase={2}
      summary="Design, video, content and copy queues with approval and revision tracking."
      capabilities={[
        'Queues per creative type with turnaround and revision metrics',
        'Submission versioning with a side-by-side version compare',
        'Annotated review — pin comments directly onto the creative',
        'Internal review gate before anything reaches the client',
        'Revision counter with billable change orders past the contracted limit',
      ]}
    />
  );
}
