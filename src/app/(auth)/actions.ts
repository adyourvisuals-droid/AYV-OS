"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils-shared";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." };
        default:
          return { error: "Something went wrong. Please try again." };
      }
    }
    throw error;
  }
}

export async function registerAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!orgName || !name || !email || password.length < 8) {
    return {
      error:
        "Please fill in all fields. Password must be at least 8 characters.",
    };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(orgName);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });
    const organization = await tx.organization.create({
      data: { name: orgName, slug },
    });
    await tx.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
    });
    await tx.pipelineStage.createMany({
      data: [
        { organizationId: organization.id, name: "New", order: 0, probability: 10 },
        { organizationId: organization.id, name: "Qualified", order: 1, probability: 25 },
        { organizationId: organization.id, name: "Proposal Sent", order: 2, probability: 50 },
        { organizationId: organization.id, name: "Negotiation", order: 3, probability: 75 },
        { organizationId: organization.id, name: "Won", order: 4, probability: 100, isWon: true },
        { organizationId: organization.id, name: "Lost", order: 5, probability: 0, isLost: true },
      ],
    });
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }
  return {};
}
