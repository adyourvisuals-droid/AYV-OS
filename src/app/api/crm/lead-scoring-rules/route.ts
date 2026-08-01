import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as scoringRuleService from "@/modules/crm/leads/scoring-rules";

export async function GET() {
  const { organization } = await getActiveOrg();
  const rules = await scoringRuleService.listLeadScoringRules(organization.id);
  return NextResponse.json({ data: rules });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const rule = await scoringRuleService.createLeadScoringRule(organization.id, body);
    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
