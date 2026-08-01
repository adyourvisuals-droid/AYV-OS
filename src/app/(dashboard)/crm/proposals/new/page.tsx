import { getActiveOrg } from "@/lib/session";
import { listDealOptions } from "@/modules/crm/deals/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { createProposalAction } from "@/modules/crm/proposals/actions";
import { ProposalForm } from "@/modules/crm/proposals/proposal-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>;
}) {
  const { dealId } = await searchParams;
  const { organization } = await getActiveOrg();
  const [deals, contacts, companies] = await Promise.all([
    listDealOptions(organization.id),
    listContactOptions(organization.id),
    listCompanyOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title="Proposal generator" description="Build a client-ready proposal." />
      <ProposalForm
        action={createProposalAction}
        deals={deals.map((d) => ({ id: d.id, label: d.title }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        defaultDealId={dealId}
      />
    </div>
  );
}
