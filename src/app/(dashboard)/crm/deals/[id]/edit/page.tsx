import { getActiveOrg } from "@/lib/session";
import { getDeal } from "@/modules/crm/deals/service";
import { listPipelineStages } from "@/modules/crm/pipeline/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { updateDealAction } from "@/modules/crm/deals/actions";
import { DealForm } from "@/modules/crm/deals/deal-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();
  const [deal, stages, companies, contacts, members] = await Promise.all([
    getDeal(organization.id, id),
    listPipelineStages(organization.id),
    listCompanyOptions(organization.id),
    listContactOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${deal.title}`} />
      <DealForm
        action={updateDealAction.bind(null, id)}
        defaults={{
          ...deal,
          value: Number(deal.value),
          expectedCloseDate: deal.expectedCloseDate,
        }}
        stages={stages}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        members={members}
        submitLabel="Save changes"
      />
    </div>
  );
}
