import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const ACTIVE_ORG_COOKIE = "ayvos_org";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function getActiveOrg() {
  const user = await requireUser();

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const membership =
    memberships.find((m) => m.organizationId === activeOrgId) ??
    memberships[0];

  return {
    user,
    organization: membership.organization,
    role: membership.role,
    memberships,
  };
}
