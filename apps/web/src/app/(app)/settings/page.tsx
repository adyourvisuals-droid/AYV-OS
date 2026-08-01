import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function SettingsPage() {
  return (
    <PhasePlaceholder
      title="Settings"
      phase={2}
      summary="Organisation profile, roles, teams, integrations and automation rules."
      capabilities={[
        'Organisation profile, GST details, working days and fiscal year',
        'Role editor built on the permission registry, with custom roles',
        'Integration connections for Meta, Google, WhatsApp and payments',
        'Visual automation rule builder with dry-run simulation',
      ]}
    />
  );
}
