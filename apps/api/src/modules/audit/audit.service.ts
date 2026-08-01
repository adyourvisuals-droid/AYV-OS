import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ActorType, Prisma } from '@prisma/client';

import { RequestContextStore } from '@/common/context/request-context';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  organizationId?: string;
  actorId?: string | null;
}

/** Fields that must never be written into the audit trail. */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'mfaSecret',
  'refreshTokenHash',
  'credentials',
  'accessToken',
  'refreshToken',
  'bankDetails',
]);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row.
   *
   * Deliberately never throws: an audit failure must not roll back the
   * business operation that succeeded. Failures are logged loudly instead.
   */
  async record(entry: AuditEntry): Promise<void> {
    const context = RequestContextStore.get();
    const organizationId = entry.organizationId ?? context?.organizationId;
    if (!organizationId) return;

    const before = this.sanitise(entry.before);
    const after = this.sanitise(entry.after);
    const changedFields = this.diffFields(before, after);

    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          actorId: entry.actorId ?? context?.userId ?? null,
          actorType: (context?.actorType ?? 'USER') as ActorType,
          agentKey: context?.agentKey ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
          changedFields,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
          requestId: context?.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${entry.action} ${entry.entity}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Recursively strips secrets and converts non-JSON values for storage. */
  private sanitise(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined || typeof value !== 'object') return null;

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(source)) {
      if (REDACTED_FIELDS.has(key)) {
        result[key] = '[redacted]';
        continue;
      }
      if (entry instanceof Date) {
        result[key] = entry.toISOString();
        continue;
      }
      if (entry && typeof entry === 'object' && 'toFixed' in entry) {
        // Prisma Decimal — stringify to preserve precision.
        result[key] = String(entry);
        continue;
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        result[key] = this.sanitise(entry);
        continue;
      }
      result[key] = entry;
    }

    return result;
  }

  private diffFields(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): string[] {
    if (!before || !after) return after ? Object.keys(after) : [];

    return Object.keys({ ...before, ...after }).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );
  }
}
