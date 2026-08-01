import { getActiveOrg } from "@/lib/session";
import { listDealOptions } from "@/modules/crm/deals/service";
import { listContactOptions } from "@/modules/crm/contacts/service";
import { listCompanyOptions } from "@/modules/crm/companies/service";
import { createQuotationAction } from "@/modules/crm/quotations/actions";
import { QuotationForm } from "@/modules/crm/quotations/quotation-form";
import { PageHeader } from "@/components/crm/page-header";

export default async function NewQuotationPage({
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
      <PageHeader title="New quotation" description="Build an itemized price quotation." />
      <QuotationForm
        action={createQuotationAction}
        deals={deals.map((d) => ({ id: d.id, label: d.title }))}
        contacts={contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        companies={companies.map((c) => ({ id: c.id, label: c.name }))}
        defaultDealId={dealId}
      />
    </div>
  );
}
