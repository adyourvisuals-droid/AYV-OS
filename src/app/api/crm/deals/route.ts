import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as dealService from "@/modules/crm/deals/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const deals = await dealService.listDeals(organization.id);
  return NextResponse.json({ data: deals });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const deal = await dealService.createDeal(organization.id, body);
    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
