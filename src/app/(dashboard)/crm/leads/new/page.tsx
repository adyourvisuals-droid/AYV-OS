import { getActiveOrg } from "@/lib/session";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { createLeadAction } from "@/modules/crm/leads/actions";
import { LeadForm } from "@/modules/crm/leads/lead-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewLeadPage() {
  const { organization } = await getActiveOrg();
  const [companies, contacts, members] = await Promise.all([
    listCompanyOptions(organization.id),
    listContactOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title="New lead" description="Capture a new inbound or outbound lead." />
      <LeadForm
        action={createLeadAction}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        members={members}
        submitLabel="Create lead"
      />
    </div>
  );
}
