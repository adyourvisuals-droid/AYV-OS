export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parses the pagination/sort/search query params shared by every list
 * endpoint. Mirrors apps/api's PaginationQueryDto, minus the class-validator
 * machinery — a URLSearchParams read replaces decorator-driven parsing.
 */
export class ListQuery {
  readonly page: number;
  readonly limit: number;
  readonly sort: string | null;
  readonly search: string | null;
  readonly deleted: boolean;
  private readonly params: URLSearchParams;

  constructor(searchParams: URLSearchParams) {
    this.params = searchParams;
    const page = Number(searchParams.get('page'));
    const limit = Number(searchParams.get('limit'));
    this.page = Number.isInteger(page) && page >= 1 ? page : 1;
    this.limit = Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 100) : 25;
    this.sort = searchParams.get('sort');
    this.search = searchParams.get('search');
    this.deleted = searchParams.get('deleted') === 'true';
  }

  get(key: string): string | null {
    return this.params.get(key);
  }

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /** Translates `sort` into a Prisma orderBy array. Unknown fields are dropped. */
  orderBy(
    allowedFields: string[],
    fallback: Record<string, 'asc' | 'desc'>[] = [],
  ): Record<string, 'asc' | 'desc'>[] {
    if (!this.sort) return fallback;

    const parsed = this.sort
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => {
        const descending = token.startsWith('-');
        const field = descending ? token.slice(1) : token;
        return allowedFields.includes(field)
          ? { [field]: descending ? ('desc' as const) : ('asc' as const) }
          : null;
      })
      .filter((entry): entry is Record<string, 'asc' | 'desc'> => entry !== null);

    return parsed.length > 0 ? parsed : fallback;
  }
}
