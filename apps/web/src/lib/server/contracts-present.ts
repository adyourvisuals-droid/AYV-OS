import type { Prisma } from '../../../generated/prisma';

export const CONTRACT_INCLUDE = {
  client: { select: { id: true, name: true } },
} satisfies Prisma.ContractInclude;

type ContractWithRelations = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

export function presentContract(contract: ContractWithRelations) {
  return {
    id: contract.id,
    number: contract.number,
    title: contract.title,
    client: contract.client,
    leadId: contract.leadId,
    status: contract.status,
    value: Number(contract.value),
    currency: contract.currency,
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    noticePeriodDays: contract.noticePeriodDays,
    signedAt: contract.signedAt?.toISOString() ?? null,
    signedByName: contract.signedByName,
    documentUrl: contract.documentUrl,
    terms: contract.terms,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}
