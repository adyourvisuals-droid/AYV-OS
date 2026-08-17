import { createHash } from 'node:crypto';

/** Meta's Graph API version for the Conversions API endpoint. */
const GRAPH_API_VERSION = 'v21.0';

/**
 * Meta requires PII to be normalized then SHA-256 hashed before it leaves our
 * servers. Normalization: trim, lowercase. Phone numbers additionally strip
 * every non-digit (Meta wants country code + number, digits only). Empty
 * inputs hash to nothing so we never send a hash of "".
 */
function hash(value: string | null | undefined, kind: 'email' | 'phone' | 'text' = 'text'): string | null {
  if (!value) return null;
  let normalized = value.trim().toLowerCase();
  if (kind === 'phone') normalized = normalized.replace(/\D/g, '');
  if (kind === 'email') normalized = normalized.replace(/\s+/g, '');
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  /** Meta click id (fbc) and browser id (fbp) — sent raw, never hashed. */
  fbc?: string | null;
  fbp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface BuildEventInput {
  eventName: string;
  eventId: string;
  eventTime?: Date;
  actionSource?: string;
  eventSourceUrl?: string | null;
  userData: CapiUserData;
  value?: number | null;
  currency?: string | null;
}

/** Builds the exact `data` entry we POST to Meta — hashing applied. */
export function buildEventData(input: BuildEventInput): Record<string, unknown> {
  const u = input.userData;
  const userData: Record<string, unknown> = {};

  const em = hash(u.email, 'email');
  const ph = hash(u.phone, 'phone');
  const fn = hash(u.firstName);
  const ln = hash(u.lastName);
  const ct = hash(u.city);

  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ct) userData.ct = [ct];
  if (u.fbc) userData.fbc = u.fbc;
  if (u.fbp) userData.fbp = u.fbp;
  if (u.clientIp) userData.client_ip_address = u.clientIp;
  if (u.userAgent) userData.client_user_agent = u.userAgent;

  const data: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor((input.eventTime ?? new Date()).getTime() / 1000),
    action_source: input.actionSource ?? 'system_generated',
    event_id: input.eventId,
    user_data: userData,
  };

  if (input.eventSourceUrl) data.event_source_url = input.eventSourceUrl;

  if (typeof input.value === 'number' && input.value > 0) {
    data.custom_data = { value: input.value, currency: input.currency ?? 'INR' };
  }

  return data;
}

export interface DispatchInput {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  eventData: Record<string, unknown>;
  /** When true, build the full request but do NOT call Meta — return the payload. */
  dryRun?: boolean;
}

export interface DispatchResult {
  ok: boolean;
  dryRun: boolean;
  /** The request body as it would be (or was) sent — access token redacted. */
  request: Record<string, unknown>;
  status?: number;
  response?: unknown;
  fbTraceId?: string;
  error?: string;
}

/**
 * Sends one server-side conversion event to Meta's Conversions API.
 *
 * `dryRun` returns the fully-built request without any network call, so the
 * payload (and its hashing) can be inspected and tested offline. A real call
 * that fails — Meta rejects the token, or the network is unreachable — never
 * throws; it resolves with `ok: false` and the error, so the caller can log a
 * FAILED event and move on without breaking the flow that triggered it.
 */
export async function dispatchConversion(input: DispatchInput): Promise<DispatchResult> {
  const body: Record<string, unknown> = { data: [input.eventData] };
  if (input.testEventCode) body.test_event_code = input.testEventCode;

  // The redacted view is what we persist and return — the token never lands
  // in an event log or an API response.
  const redactedRequest = { ...body, access_token: '***redacted***' };

  if (input.dryRun) {
    return { ok: true, dryRun: true, request: redactedRequest };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(input.pixelId)}/events`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: input.accessToken }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const fbTraceId = res.headers.get('x-fb-trace-id') ?? undefined;
    let response: unknown = null;
    try {
      response = await res.json();
    } catch {
      response = await res.text().catch(() => null);
    }

    if (!res.ok) {
      const errObj =
        response && typeof response === 'object' && 'error' in response
          ? (response as { error?: { message?: string } }).error
          : null;
      return {
        ok: false,
        dryRun: false,
        request: redactedRequest,
        status: res.status,
        response,
        fbTraceId,
        error: errObj?.message ?? `Meta returned HTTP ${res.status}`,
      };
    }

    return { ok: true, dryRun: false, request: redactedRequest, status: res.status, response, fbTraceId };
  } catch (caught) {
    return {
      ok: false,
      dryRun: false,
      request: redactedRequest,
      error: caught instanceof Error ? caught.message : 'Network error reaching Meta',
    };
  }
}
