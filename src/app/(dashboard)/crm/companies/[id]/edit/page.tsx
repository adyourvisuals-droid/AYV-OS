import { getActiveOrg } from "@/lib/session";
import { getCompany } from "@/modules/crm/companies/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { updateCompanyAction } from "@/modules/crm/companies/actions";
import { CompanyForm } from "@/modules/crm/companies/company-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();
  const [company, members] = await Promise.all([
    getCompany(organization.id, id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${company.name}`} />
      <CompanyForm
        action={updateCompanyAction.bind(null, id)}
        defaults={company}
        members={members}
        submitLabel="Save changes"
      />
    </div>
  );
}
