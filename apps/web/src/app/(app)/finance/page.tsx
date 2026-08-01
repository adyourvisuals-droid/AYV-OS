import { PhasePlaceholder } from '@/components/features/phase-placeholder';

export default function FinancePage() {
  return (
    <PhasePlaceholder
      title="Finance"
      phase={2}
      summary="Invoicing with Indian GST, expenses, vendors, P&L and cash-flow forecasting."
      capabilities={[
        'Invoices with CGST/SGST and IGST decided by comparing state codes',
        'Payment recording and reconciliation against receivables',
        'Expense submission with approval routing by amount tier',
        'P&L, cash flow, ageing buckets and budget-versus-actual',
        'Automated dunning ladder from due-date reminder to service pause',
      ]}
    />
  );
}
