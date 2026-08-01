import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as contractService from "@/modules/crm/contracts/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const contracts = await contractService.listContracts(organization.id);
  return NextResponse.json({ data: contracts });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const contract = await contractService.createContract(organization.id, body);
    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
