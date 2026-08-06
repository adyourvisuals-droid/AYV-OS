import type { Prisma } from '../../../generated/prisma';

export const INVOICE_INCLUDE = {
  client: {
    select: {
      id: true,
      name: true,
      legalName: true,
      email: true,
      phone: true,
      addressLine1: true,
      city: true,
      state: true,
      stateCode: true,
      country: true,
      postalCode: true,
      gstNumber: true,
    },
  },
  items: true,
  payments: { orderBy: { paidAt: 'desc' } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

export function presentInvoice(invoice: InvoiceWithRelations) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    client: invoice.client,
    projectId: invoice.projectId,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    cgst: Number(invoice.cgst),
    sgst: Number(invoice.sgst),
    igst: Number(invoice.igst),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balance: Number(invoice.total) - Number(invoice.amountPaid),
    currency: invoice.currency,
    isOverdue:
      invoice.status !== 'PAID' &&
      invoice.status !== 'CANCELLED' &&
      invoice.status !== 'REFUNDED' &&
      invoice.dueDate < new Date(),
    notes: invoice.notes,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      amount: Number(item.amount),
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt.toISOString(),
      note: payment.note,
    })),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export const EXPENSE_INCLUDE = {
  submittedBy: { select: { id: true, name: true, avatarUrl: true } },
  vendor: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

export function presentExpense(expense: ExpenseWithRelations) {
  return {
    id: expense.id,
    title: expense.title,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    status: expense.status,
    incurredAt: expense.incurredAt.toISOString(),
    receiptUrl: expense.receiptUrl,
    submittedBy: expense.submittedBy,
    vendor: expense.vendor,
    approvedAt: expense.approvedAt?.toISOString() ?? null,
    createdAt: expense.createdAt.toISOString(),
  };
}

export function presentVendor(vendor: {
  id: string;
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  createdAt: Date;
}) {
  return {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    email: vendor.email,
    phone: vendor.phone,
    gstNumber: vendor.gstNumber,
    createdAt: vendor.createdAt.toISOString(),
  };
}

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface GstSplit {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  total: number;
}

/**
 * Splits tax into CGST+SGST (intra-state) or IGST (inter-state) by comparing
 * the organisation's home state code against the client's, per Indian GST
 * rules — see docs/02-database-schema.md.
 */
export function computeGst(lines: InvoiceLineInput[], sameState: boolean): GstSplit {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const taxAmount = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice * (line.taxRate / 100),
    0,
  );

  return {
    subtotal: Math.round(subtotal),
    cgst: sameState ? Math.round(taxAmount / 2) : 0,
    sgst: sameState ? Math.round(taxAmount / 2) : 0,
    igst: sameState ? 0 : Math.round(taxAmount),
    taxAmount: Math.round(taxAmount),
    total: Math.round(subtotal + taxAmount),
  };
}
