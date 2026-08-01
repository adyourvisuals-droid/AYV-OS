import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as activityService from "@/modules/crm/activities/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { organization } = await getActiveOrg();
  const { id } = await params;
  try {
    const activity = await activityService.getActivity(organization.id, id);
    return NextResponse.json({ data: activity });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { organization } = await getActiveOrg();
  const { id } = await params;
  try {
    const body = await request.json();
    const activity = await activityService.updateActivity(organization.id, id, body);
    return NextResponse.json({ data: activity });
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
    await activityService.deleteActivity(organization.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
