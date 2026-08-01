import { getActiveOrg } from "@/lib/session";
import { listPipelineStages } from "@/modules/crm/pipeline/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { createDealAction } from "@/modules/crm/deals/actions";
import { DealForm } from "@/modules/crm/deals/deal-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewDealPage() {
  const { organization } = await getActiveOrg();
  const [stages, companies, contacts, members] = await Promise.all([
    listPipelineStages(organization.id),
    listCompanyOptions(organization.id),
    listContactOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title="New deal" description="Add a deal to your pipeline." />
      <DealForm
        action={createDealAction}
        stages={stages}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        members={members}
        submitLabel="Create deal"
      />
    </div>
  );
}
