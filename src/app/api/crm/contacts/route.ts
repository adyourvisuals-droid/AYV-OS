import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as contactService from "@/modules/crm/contacts/service";

export async function GET(request: NextRequest) {
  const { organization } = await getActiveOrg();
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const contacts = await contactService.listContacts(organization.id, search);
  return NextResponse.json({ data: contacts });
}

export async function POST(request: NextRequest) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const contact = await contactService.createContact(organization.id, body);
    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
