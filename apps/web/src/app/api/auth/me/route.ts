import type { NextRequest } from 'next/server';

import { loadPrincipal, verifyAccessToken } from '@/lib/server/auth';
import { errorResponse, successResponse } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const header = req.headers.get('authorization');
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;

  if (!token) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return errorResponse(401, 'TOKEN_EXPIRED', 'Invalid or expired token');
  }

  const principal = await loadPrincipal(payload.sub);
  if (!principal) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Account is no longer active');
  }

  return successResponse({
    id: principal.userId,
    name: principal.name,
    email: principal.email,
    organizationId: principal.organizationId,
    clientId: principal.clientId,
    role: { id: principal.roleId, key: principal.roleKey, level: principal.roleLevel },
    permissions: principal.permissions,
    permissionScopes: principal.permissionScopes,
  });
}
