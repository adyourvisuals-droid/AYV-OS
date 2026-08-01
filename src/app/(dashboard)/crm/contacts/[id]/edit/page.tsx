import { getActiveOrg } from "@/lib/session";
import { getContact } from "@/modules/crm/contacts/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { listOrgMemberOptions } from "@/modules/crm/members";
import { updateContactAction } from "@/modules/crm/contacts/actions";
import { ContactForm } from "@/modules/crm/contacts/contact-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();
  const [contact, companies, members] = await Promise.all([
    getContact(organization.id, id),
    listCompanyOptions(organization.id),
    listOrgMemberOptions(organization.id),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${contact.firstName} ${contact.lastName ?? ""}`} />
      <ContactForm
        action={updateContactAction.bind(null, id)}
        defaults={contact}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        members={members}
        submitLabel="Save changes"
      />
    </div>
  );
}
