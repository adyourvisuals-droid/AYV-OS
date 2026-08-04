import type { NextRequest } from 'next/server';

import { PERMISSIONS } from '@ayv/types';

import { prisma } from '@/lib/server/db';
import { ENTITY_TYPES, FIELD_TYPES, presentDefinition } from '@/lib/server/custom-fields';
import { errorResponse, successResponse } from '@/lib/server/http';
import { withAuth } from '@/lib/server/require-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.SETTING_READ], async () => {
    const entityType = req.nextUrl.searchParams.get('entityType');
    if (entityType && !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return errorResponse(400, 'VALIDATION_ERROR', `entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
    }

    const definitions = await prisma.customFieldDefinition.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: [{ entityType: 'asc' }, { position: 'asc' }],
    });

    return successResponse(definitions.map((definition) => presentDefinition(definition)));
  });
}

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export async function POST(req: NextRequest) {
  return withAuth(req, [PERMISSIONS.CUSTOM_FIELD_MANAGE], async (principal) => {
    let body: {
      entityType?: unknown;
      key?: unknown;
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

    const entityType = typeof body.entityType === 'string' ? body.entityType : '';
    const key = typeof body.key === 'string' ? body.key.trim().toLowerCase().replace(/\s+/g, '_') : '';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const fieldType = typeof body.fieldType === 'string' ? body.fieldType : '';

    if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return errorResponse(400, 'VALIDATION_ERROR', `entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
    }
    if (!(FIELD_TYPES as readonly string[]).includes(fieldType)) {
      return errorResponse(400, 'VALIDATION_ERROR', `fieldType must be one of: ${FIELD_TYPES.join(', ')}`);
    }
    if (!key || !KEY_PATTERN.test(key)) {
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        'key must start with a lowercase letter and contain only lowercase letters, numbers and underscores',
      );
    }
    if (!label) {
      return errorResponse(400, 'VALIDATION_ERROR', 'label is required');
    }

    const options = Array.isArray(body.options)
      ? body.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
      : [];
    if (fieldType === 'SELECT' && options.length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'SELECT fields require at least one option');
    }

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { entityType, key },
    });
    if (existing) {
      return errorResponse(409, 'CONFLICT', `A "${key}" field already exists on ${entityType}`);
    }

    const created = await prisma.customFieldDefinition.create({
      data: {
        organizationId: principal.organizationId,
        entityType,
        key,
        label,
        fieldType,
        options,
        required: body.required === true,
        position: typeof body.position === 'number' ? body.position : 0,
      },
    });

    return successResponse(presentDefinition(created));
  });
}
