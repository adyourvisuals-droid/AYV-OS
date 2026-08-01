import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as activityService from "@/modules/crm/activities/service";
import type { ActivityType } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  const { organization } = await getActiveOrg();
  const type = request.nextUrl.searchParams.get("type") as ActivityType | null;
  const leadId = request.nextUrl.searchParams.get("leadId") ?? undefined;
  const dealId = request.nextUrl.searchParams.get("dealId") ?? undefined;
  const contactId = request.nextUrl.searchParams.get("contactId") ?? undefined;
  const companyId = request.nextUrl.searchParams.get("companyId") ?? undefined;

  const activities = type
    ? await activityService.listActivitiesByType(organization.id, type, {
        leadId,
        dealId,
        contactId,
        companyId,
      })
    : await activityService.listActivitiesForRecord(organization.id, {
        leadId,
        dealId,
        contactId,
        companyId,
      });

  return NextResponse.json({ data: activities });
}

export async function POST(request: NextRequest) {
  const { organization, user } = await getActiveOrg();
  try {
    const body = await request.json();
    const activity = await activityService.createActivity(organization.id, {
      ...body,
      createdById: user.id,
    });
    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
