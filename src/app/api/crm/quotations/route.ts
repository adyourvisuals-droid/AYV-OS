import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as quotationService from "@/modules/crm/quotations/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const quotations = await quotationService.listQuotations(organization.id);
  return NextResponse.json({ data: quotations });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const quotation = await quotationService.createQuotation(organization.id, body);
    return NextResponse.json({ data: quotation }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
