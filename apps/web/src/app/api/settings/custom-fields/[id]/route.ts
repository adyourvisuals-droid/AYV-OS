import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { FIELD_TYPES, presentDefinition } from '@/lib/server/custom-fields';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CUSTOM_FIELD_MANAGE], async () => {
    const { id } = await params;

    let body: {
      label?: unknown;
      fieldType?: unknown;
      options?: unknown;
      required?: unknown;
      position?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    const definition = await prisma.customFieldDefinition.findFirst({ where: { id } });
    if (!definition) return errorResponse(404, 'NOT_FOUND', 'Custom field not found');

    if (body.fieldType !== undefined && !(FIELD_TYPES as readonly string[]).includes(body.fieldType as string)) {
      return errorResponse(400, 'VALIDATION_ERROR', `fieldType must be one of: ${FIELD_TYPES.join(', ')}`);
    }

    const nextFieldType = typeof body.fieldType === 'string' ? body.fieldType : definition.fieldType;
    const options = Array.isArray(body.options)
      ? body.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
      : undefined;
    if (nextFieldType === 'SELECT' && (options ?? definition.options).length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'SELECT fields require at least one option');
    }

    const updated = await prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(typeof body.label === 'string' && body.label.trim() ? { label: body.label.trim() } : {}),
        ...(typeof body.fieldType === 'string' ? { fieldType: body.fieldType } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(typeof body.required === 'boolean' ? { required: body.required } : {}),
        ...(typeof body.position === 'number' ? { position: body.position } : {}),
      },
    });

    return successResponse(presentDefinition(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, [PERMISSIONS.CUSTOM_FIELD_MANAGE], async () => {
    const { id } = await params;

    const definition = await prisma.customFieldDefinition.findFirst({ where: { id } });
    if (!definition) return errorResponse(404, 'NOT_FOUND', 'Custom field not found');

    await prisma.customFieldDefinition.delete({ where: { id } });
    return successResponse({ success: true });
  });
}
