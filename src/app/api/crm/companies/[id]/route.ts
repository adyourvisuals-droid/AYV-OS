import { NextResponse } from "next/server";

import { getActiveOrg } from "@/lib/session";
import { ServiceError } from "@/modules/crm/shared";
import * as companyService from "@/modules/crm/companies/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { organization } = await getActiveOrg();
  const { id } = await params;
  try {
    const company = await companyService.getCompany(organization.id, id);
    return NextResponse.json({ data: company });
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
    const company = await companyService.updateCompany(organization.id, id, body);
    return NextResponse.json({ data: company });
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
    await companyService.deleteCompany(organization.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
