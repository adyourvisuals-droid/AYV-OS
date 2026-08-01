/** Transport shapes shared by every endpoint. */

export interface ApiMeta {
  timestamp: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta & Partial<PaginationMeta>;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  deleted?: boolean;
}

/** Narrowing helper so callers can branch on the envelope safely. */
export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return res.success === false;
}
