import { NextResponse } from 'next/server';

import type { ApiErrorCode } from '@ayv/types';

/** Matches the envelope apps/api returns, so the existing client code in
 * src/lib/api.ts needs no changes to unwrap these responses. */
export function errorResponse(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function successResponse<T>(data: T) {
  return NextResponse.json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  });
}
