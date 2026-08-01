import { notFound } from "next/navigation";

import { getActiveOrg } from "@/lib/session";
import { getQuotation } from "@/modules/crm/quotations/service";
import { deleteQuotationAction } from "@/modules/crm/quotations/actions";
import { QuotationStatusActions } from "@/modules/crm/quotations/quotation-status-actions";
import { PageHeader } from "@/components/crm/page-header";
import { StatusBadge } from "@/components/crm/status-badge";
import { DeleteButton } from "@/components/crm/delete-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils-shared";
import { ServiceError } from "@/modules/crm/shared";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await getActiveOrg();

  let quotation;
  try {
    quotation = await getQuotation(organization.id, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  const subtotal = quotation.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );
  const taxAmount = subtotal * (Number(quotation.taxPercent) / 100);

  return (
    <div>
      <PageHeader
        title={quotation.title}
        description={`${quotation.number} · ${quotation.deal?.title ?? "No linked deal"}`}
        actions={
          <>
            <QuotationStatusActions id={quotation.id} status={quotation.status} />
            <DeleteButton action={deleteQuotationAction.bind(null, quotation.id)} />
          </>
        }
      />

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-6 p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Quotation</p>
              <h2 className="text-lg font-semibold">{quotation.title}</h2>
              <p className="text-sm text-muted-foreground">{quotation.number}</p>
            </div>
            <StatusBadge status={quotation.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prepared for</p>
              <p>
                {quotation.company?.name ??
                  (quotation.contact
                    ? `${quotation.contact.firstName} ${quotation.contact.lastName ?? ""}`.trim()
                    : "—")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Valid until</p>
              <p>
                {quotation.validUntil
                  ? new Date(quotation.validUntil).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </td>
                  <td className="py-2">{Number(item.quantity)}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(Number(item.unitPrice), quotation.currency)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(
                      Number(item.quantity) * Number(item.unitPrice),
                      quotation.currency
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, quotation.currency)}</span>
              </div>
              {Number(quotation.taxPercent) > 0 ? (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Tax ({Number(quotation.taxPercent)}%)</span>
                  <span>{formatCurrency(taxAmount, quotation.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t py-1 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(Number(quotation.totalAmount), quotation.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
