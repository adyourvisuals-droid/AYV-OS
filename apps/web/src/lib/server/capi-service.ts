import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/server/db';
import { decryptSecret } from '@/lib/server/crypto';
import {
  buildEventData,
  dispatchConversion,
  type CapiUserData,
} from '@/lib/server/meta-capi';

type CapiConfigRow = {
  id: string;
  clientId: string;
  pixelId: string;
  datasetId: string | null;
  testEventCode: string | null;
  defaultEventName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Config for display — the encrypted token becomes a boolean, never plaintext. */
export function presentCapiConfig(config: CapiConfigRow & { accessTokenCipher?: string }) {
  return {
    id: config.id,
    clientId: config.clientId,
    pixelId: config.pixelId,
    datasetId: config.datasetId,
    testEventCode: config.testEventCode,
    defaultEventName: config.defaultEventName,
    isActive: config.isActive,
    hasAccessToken: Boolean(config.accessTokenCipher),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

type CapiEventRow = {
  id: string;
  eventName: string;
  status: string;
  testMode: boolean;
  eventId: string;
  errorMessage: string | null;
  fbTraceId: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  leadId: string | null;
  createdAt: Date;
};

export function presentCapiEvent(event: CapiEventRow) {
  return {
    id: event.id,
    eventName: event.eventName,
    status: event.status,
    testMode: event.testMode,
    eventId: event.eventId,
    errorMessage: event.errorMessage,
    fbTraceId: event.fbTraceId,
    requestPayload: event.requestPayload,
    responsePayload: event.responsePayload,
    leadId: event.leadId,
    createdAt: event.createdAt.toISOString(),
  };
}

interface SendConversionInput {
  organizationId: string;
  clientId: string;
  leadId?: string | null;
  eventName?: string;
  userData: CapiUserData;
  value?: number | null;
  currency?: string | null;
  eventSourceUrl?: string | null;
  dryRun?: boolean;
  testMode?: boolean;
  createdById?: string | null;
}

/**
 * Builds, dispatches (or dry-runs) and LOGS one conversion for a client.
 *
 * Every call writes a CapiEvent row — SENT, FAILED, SKIPPED or TEST — so the
 * event log is the single source of truth for what left the building. When the
 * client has no active config it's a graceful SKIPPED, not an error: a client
 * who never ran Meta ads simply produces no conversions.
 */
export async function sendClientConversion(input: SendConversionInput) {
  const config = await prisma.metaCapiConfig.findFirst({
    where: { clientId: input.clientId, isActive: true },
  });

  const eventName = input.eventName || config?.defaultEventName || 'Lead';
  const eventId = randomUUID();

  if (!config) {
    const skipped = await prisma.capiEvent.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        leadId: input.leadId ?? null,
        eventName,
        status: 'SKIPPED',
        testMode: Boolean(input.testMode),
        eventId,
        requestPayload: { skipped: 'No active Meta Conversions API config for this client' },
        createdById: input.createdById ?? null,
      },
    });
    return { skipped: true as const, event: skipped };
  }

  const eventData = buildEventData({
    eventName,
    eventId,
    actionSource: 'system_generated',
    eventSourceUrl: input.eventSourceUrl ?? null,
    userData: input.userData,
    value: input.value ?? null,
    currency: input.currency ?? null,
  });

  let accessToken = '';
  try {
    accessToken = decryptSecret(config.accessTokenCipher);
  } catch {
    const failed = await prisma.capiEvent.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        configId: config.id,
        leadId: input.leadId ?? null,
        eventName,
        status: 'FAILED',
        testMode: Boolean(input.testMode),
        eventId,
        requestPayload: eventData,
        errorMessage: 'Stored access token could not be decrypted',
        createdById: input.createdById ?? null,
      },
    });
    return { skipped: false as const, event: failed, result: { ok: false } };
  }

  const result = await dispatchConversion({
    pixelId: config.pixelId,
    accessToken,
    testEventCode: input.testMode ? config.testEventCode : null,
    eventData,
    dryRun: input.dryRun,
  });

  const status = input.dryRun || input.testMode ? 'TEST' : result.ok ? 'SENT' : 'FAILED';

  const event = await prisma.capiEvent.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      configId: config.id,
      leadId: input.leadId ?? null,
      eventName,
      status,
      testMode: Boolean(input.dryRun || input.testMode),
      eventId,
      requestPayload: result.request as never,
      responsePayload: (result.response ?? null) as never,
      errorMessage: result.error ?? null,
      fbTraceId: result.fbTraceId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  return { skipped: false as const, event, result };
}

/**
 * The automatic hook: when a lead is won, if it has been converted to a client
 * with an active Meta config, fire the configured conversion. Wrapped so it can
 * be called fire-and-forget from a stage change without ever breaking it.
 */
export async function dispatchLeadWonConversion(lead: {
  id: string;
  organizationId: string;
  convertedClientId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  city: string | null;
  estimatedValue: unknown;
  currency: string;
  sourceMeta: unknown;
  createdById?: string | null;
}): Promise<void> {
  if (!lead.convertedClientId) return;

  // Silently no-op when the client isn't wired for Meta — most clients aren't,
  // and the automatic path shouldn't fill the event log with SKIPPED noise.
  const config = await prisma.metaCapiConfig.findFirst({
    where: { clientId: lead.convertedClientId, isActive: true },
    select: { id: true },
  });
  if (!config) return;

  const meta = (lead.sourceMeta ?? {}) as Record<string, unknown>;
  const [firstName, ...rest] = (lead.contactName ?? '').trim().split(/\s+/);

  try {
    await sendClientConversion({
      organizationId: lead.organizationId,
      clientId: lead.convertedClientId,
      leadId: lead.id,
      userData: {
        email: lead.email,
        phone: lead.phone,
        firstName: firstName || null,
        lastName: rest.length ? rest.join(' ') : null,
        city: lead.city,
        fbc: typeof meta.fbc === 'string' ? meta.fbc : null,
        fbp: typeof meta.fbp === 'string' ? meta.fbp : null,
      },
      value: Number(lead.estimatedValue) || null,
      currency: lead.currency,
      createdById: lead.createdById ?? null,
    });
  } catch {
    // Never let conversion reporting break the sale it's reporting on.
  }
}
