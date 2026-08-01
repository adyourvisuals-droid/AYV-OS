import { getActiveOrg } from "@/lib/session";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { createContactAction } from "@/modules/crm/contacts/actions";
import { ContactForm } from "@/modules/crm/contacts/contact-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewContactPage() {
  const { organization } = await getActiveOrg();
  const [companies, members] = await Promise.all([
    listCompanyOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title="New contact" />
      <ContactForm
        action={createContactAction}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        members={members}
        submitLabel="Create contact"
      />
    </div>
  );
}
