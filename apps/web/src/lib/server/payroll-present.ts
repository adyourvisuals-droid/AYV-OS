export const PAYROLL_STATUSES = ['DRAFT', 'APPROVED', 'PAID'] as const;

export interface PayrollRow {
  id: string;
  userId: string;
  month: number;
  year: number;
  basic: unknown;
  allowances: unknown;
  deductions: unknown;
  bonus: unknown;
  netPay: unknown;
  currency: string;
  presentDays: unknown;
  status: string;
  paidAt: Date | null;
  updatedAt: Date;
}

/** Recomputes net from the components so the stored value can never drift from what's shown. */
export function computeNetPay(basic: number, allowances: number, bonus: number, deductions: number): number {
  return Math.max(0, Math.round(basic + allowances + bonus - deductions));
}

export function presentPayroll(row: PayrollRow, user?: { id: string; name: string; designation: string | null }) {
  return {
    id: row.id,
    user: user ? { id: user.id, name: user.name, designation: user.designation } : { id: row.userId, name: '—', designation: null },
    month: row.month,
    year: row.year,
    basic: Number(row.basic),
    allowances: Number(row.allowances),
    deductions: Number(row.deductions),
    bonus: Number(row.bonus),
    netPay: Number(row.netPay),
    currency: row.currency,
    presentDays: row.presentDays === null ? null : Number(row.presentDays),
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
