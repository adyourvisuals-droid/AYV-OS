import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as proposalService from "@/modules/crm/proposals/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const proposals = await proposalService.listProposals(organization.id);
  return NextResponse.json({ data: proposals });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const proposal = await proposalService.createProposal(organization.id, body);
    return NextResponse.json({ data: proposal }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
