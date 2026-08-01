import { getActiveOrg } from "@/lib/session";
import { getLead } from "@/modules/crm/leads/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { updateLeadAction } from "@/modules/crm/leads/actions";
import { LeadForm } from "@/modules/crm/leads/lead-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();
  const [lead, companies, contacts, members] = await Promise.all([
    getLead(organization.id, id),
    listCompanyOptions(organization.id),
    listContactOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  const boundAction = updateLeadAction.bind(null, id);

  return (
    <div>
      <PageHeader title={`Edit ${lead.name}`} />
      <LeadForm
        action={boundAction}
        defaults={{ ...lead, budget: lead.budget ? Number(lead.budget) : null }}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        members={members}
        submitLabel="Save changes"
      />
    </div>
  );
}
