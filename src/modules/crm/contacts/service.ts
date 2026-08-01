import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type ContactInput = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  title?: string;
  companyId?: string;
  ownerId?: string;
  tags?: string[];
};

export function listContacts(organizationId: string, search?: string) {
  return db.contact.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContact(organizationId: string, id: string) {
  const contact = await db.contact.findFirst({
    where: { id, organizationId },
    include: {
      company: true,
      owner: { select: { id: true, name: true, email: true } },
      deals: { include: { stage: true }, orderBy: { createdAt: "desc" } },
      leads: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      proposals: { orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) notFound("Contact");
  return contact;
}

export function createContact(organizationId: string, input: ContactInput) {
  requireField(input.firstName, "First name");
  return db.contact.create({ data: { organizationId, ...input } });
}

export async function updateContact(
  organizationId: string,
  id: string,
  input: Partial<ContactInput>
) {
  const existing = await db.contact.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Contact");
  return db.contact.update({ where: { id }, data: input });
}

export async function deleteContact(organizationId: string, id: string) {
  const existing = await db.contact.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Contact");
  await db.contact.delete({ where: { id } });
}

export function listContactOptions(organizationId: string) {
  return db.contact.findMany({
    where: { organizationId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });
}
