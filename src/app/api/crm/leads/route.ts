import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as leadService from "@/modules/crm/leads/service";
import type { LeadStatus } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  const { organization } = await getActiveOrg();
  const status = request.nextUrl.searchParams.get("status") as LeadStatus | null;
  const search = request.nextUrl.searchParams.get("q") ?? undefined;
  const leads = await leadService.listLeads(organization.id, {
    status: status ?? undefined,
    search,
  });
  return NextResponse.json({ data: leads });
}

export async function POST(request: NextRequest) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const lead = await leadService.createLead(organization.id, body);
    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
