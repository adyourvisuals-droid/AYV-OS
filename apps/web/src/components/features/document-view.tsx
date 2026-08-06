'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui';
import { useBranding } from '@/lib/use-branding';

/** Triggers the browser's native print dialog — "Save as PDF" is a print destination in every modern browser. */
export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()} className="print-hidden">
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

/** Org letterhead — name, address, GSTIN/PAN — shared across Invoice/Quotation/Contract documents. */
export function DocumentLetterhead() {
  const { branding, loading } = useBranding();
  if (loading || !branding) return <div className="h-16" />;

  const addressLines = [
    branding.addressLine1,
    branding.addressLine2,
    [branding.city, branding.state, branding.postalCode].filter(Boolean).join(', '),
    branding.country,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-subtle pb-4">
      <div className="flex items-start gap-3">
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded object-contain" />
        )}
        <div>
          <p className="text-heading-md font-semibold text-primary">{branding.legalName || branding.name}</p>
          {addressLines.length > 0 && (
            <p className="max-w-sm text-body-sm text-secondary">{addressLines.join(', ')}</p>
          )}
          <p className="text-caption text-tertiary">
            {[branding.email, branding.phone, branding.website].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="text-right text-caption text-tertiary">
        {branding.gstNumber && <p>GSTIN: {branding.gstNumber}</p>}
        {branding.panNumber && <p>PAN: {branding.panNumber}</p>}
      </div>
    </div>
  );
}

/** Bank/UPI payment instructions — omitted entirely when the org hasn't configured any. */
export function DocumentBankDetails() {
  const { branding } = useBranding();
  if (!branding) return null;
  if (!branding.bankName && !branding.bankAccountNumber && !branding.bankUpiId) return null;

  return (
    <div className="space-y-1 text-body-sm text-secondary">
      <p className="text-overline uppercase text-tertiary">Payment details</p>
      {branding.bankAccountName && <p>Account name: {branding.bankAccountName}</p>}
      {branding.bankName && <p>Bank: {branding.bankName}</p>}
      {branding.bankAccountNumber && <p>Account number: {branding.bankAccountNumber}</p>}
      {branding.bankIfscCode && <p>IFSC: {branding.bankIfscCode}</p>}
      {branding.bankUpiId && <p>UPI: {branding.bankUpiId}</p>}
    </div>
  );
}

/** The printable page itself — white background, contained width, comfortable margins on screen and in print. */
export function DocumentPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-subtle bg-surface p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {children}
    </div>
  );
}
