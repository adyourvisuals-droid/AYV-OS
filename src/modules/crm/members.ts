import { db } from "@/lib/db";

export async function listOrgMemberOptions(organizationId: string) {
  const memberships = await db.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email,
  }));
}
