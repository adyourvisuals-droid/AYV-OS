export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function notFound(entity: string): never {
  throw new ServiceError(`${entity} not found`, 404);
}

export function requireField(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") {
    throw new ServiceError(`${field} is required`, 400);
  }
}

export function toDecimalOrUndefined(
  value: FormDataEntryValue | null | undefined
): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function toDateOrUndefined(
  value: FormDataEntryValue | null | undefined
): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** "__none__" is the sentinel value used by <RelationSelect> for its
 *  optional "None" option, since form-backed Select components can't
 *  submit an empty string. Treated the same as empty/unset. */
export function toStringOrUndefined(
  value: FormDataEntryValue | null | undefined
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str === "" || str === "__none__" ? undefined : str;
}
