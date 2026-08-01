import { getActiveOrg } from "@/lib/session";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { createCompanyAction } from "@/modules/crm/companies/actions";
import { CompanyForm } from "@/modules/crm/companies/company-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewCompanyPage() {
  const { organization } = await getActiveOrg();
  const members = await listOrgMemberOptions(organization.id);

  return (
    <div>
      <PageHeader title="New company" />
      <CompanyForm action={createCompanyAction} members={members} submitLabel="Create company" />
    </div>
  );
}
