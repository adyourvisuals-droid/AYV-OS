"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";
import { ACTIVE_ORG_COOKIE } from "@/lib/session";

export async function switchOrgAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;
  await setActiveOrg(organizationId);
  redirect("/");
}

export async function setActiveOrg(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
