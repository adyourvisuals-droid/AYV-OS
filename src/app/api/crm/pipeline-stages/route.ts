import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as pipelineService from "@/modules/crm/pipeline/service";

export async function GET() {
  const { organization } = await getActiveOrg();
  const stages = await pipelineService.listPipelineStages(organization.id);
  return NextResponse.json({ data: stages });
}

export async function POST(request: Request) {
  const { organization } = await getActiveOrg();
  try {
    const body = await request.json();
    const stage = await pipelineService.createPipelineStage(organization.id, body);
    return NextResponse.json({ data: stage }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
