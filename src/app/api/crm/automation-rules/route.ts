import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as automationService from "@/modules/crm/automations/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const rules = await automationService.listAutomationRules(organization.id);
  return NextResponse.json({ data: rules });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const rule = await automationService.createAutomationRule(organization.id, body);
    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
