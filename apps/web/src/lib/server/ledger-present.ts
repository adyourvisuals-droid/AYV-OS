import type { Prisma } from '../../../generated/prisma';

export const LEDGER_ENTRY_TYPES = ['INCOME', 'EXPENSE'] as const;

export const LEDGER_ENTRY_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DailyLedgerEntryInclude;

type LedgerEntryWithRelations = Prisma.DailyLedgerEntryGetPayload<{ include: typeof LEDGER_ENTRY_INCLUDE }>;

export function presentLedgerEntry(entry: LedgerEntryWithRelations) {
  return {
    id: entry.id,
    type: entry.type,
    category: entry.category,
    amount: Number(entry.amount),
    date: entry.date.toISOString(),
    note: entry.note,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString(),
  };
}
