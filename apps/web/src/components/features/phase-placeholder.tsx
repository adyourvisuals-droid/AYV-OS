'use client';

import Link from 'next/link';
import { ArrowRight, Construction } from 'lucide-react';

import { PageHeader } from '@/components/layout/app-shell';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/ui';

/**
 * A navigable placeholder for modules scheduled in a later phase.
 *
 * Navigation is filtered by permission, not by build status, so these routes
 * are reachable. Showing what is planned — and when — is more useful than a
 * 404, and it keeps the roadmap visible inside the product itself.
 */
export function PhasePlaceholder({
  title,
  phase,
  summary,
  capabilities,
}: {
  title: string;
  phase: 2 | 3 | 4;
  summary: string;
  capabilities: string[];
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={summary}
        actions={<Badge tone="ai">Phase {phase}</Badge>}
      />

      <div className="p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="flex items-center gap-2">
            <Construction className="h-4 w-4 text-warning" aria-hidden />
            <CardTitle>Scheduled for Phase {phase}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-body-sm text-secondary">
              The data model, API surface and permissions for this module are already
              designed and in the schema. The interface lands in Phase {phase}.
            </p>

            <ul className="mt-4 space-y-1.5">
              {capabilities.map((capability) => (
                <li key={capability} className="flex items-start gap-2 text-body-sm text-primary">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                  {capability}
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-1 text-body-sm font-medium text-brand-600 hover:underline"
            >
              Back to dashboard
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
