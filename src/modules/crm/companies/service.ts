import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type CompanyInput = {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  description?: string;
  ownerId?: string;
};

export function listCompanies(organizationId: string, search?: string) {
  return db.company.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { domain: { contains: search, mode: "insensitive" } },
              { industry: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { contacts: true, deals: true, leads: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompany(organizationId: string, id: string) {
  const company = await db.company.findFirst({
    where: { id, organizationId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { orderBy: { createdAt: "desc" } },
      deals: { include: { stage: true }, orderBy: { createdAt: "desc" } },
      leads: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      proposals: { orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!company) notFound("Company");
  return company;
}

export function createCompany(organizationId: string, input: CompanyInput) {
  requireField(input.name, "Name");
  return db.company.create({
    data: { organizationId, ...input },
  });
}

export async function updateCompany(
  organizationId: string,
  id: string,
  input: Partial<CompanyInput>
) {
  const existing = await db.company.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Company");
  return db.company.update({ where: { id }, data: input });
}

export async function deleteCompany(organizationId: string, id: string) {
  const existing = await db.company.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Company");
  await db.company.delete({ where: { id } });
}

export function listCompanyOptions(organizationId: string) {
  return db.company.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
