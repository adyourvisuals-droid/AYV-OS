import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as pipelineService from "@/modules/crm/pipeline/service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { organization } = await getActiveOrg();
  const { id } = await params;
  try {
    const body = await request.json();
    const stage = await pipelineService.updatePipelineStage(organization.id, id, body);
    return NextResponse.json({ data: stage });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { organization } = await getActiveOrg();
  const { id } = await params;
  try {
    await pipelineService.deletePipelineStage(organization.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
