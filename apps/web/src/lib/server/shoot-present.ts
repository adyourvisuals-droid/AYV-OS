import type { Prisma } from '../../../generated/prisma';

export const SHOOT_STATUSES = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

export const SHOOT_INCLUDE = {
  client: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ShootInclude;

type ShootWithRelations = Prisma.ShootGetPayload<{ include: typeof SHOOT_INCLUDE }>;

export function presentShoot(shoot: ShootWithRelations) {
  return {
    id: shoot.id,
    title: shoot.title,
    client: shoot.client,
    type: shoot.type,
    scheduledAt: shoot.scheduledAt.toISOString(),
    endAt: shoot.endAt?.toISOString() ?? null,
    location: shoot.location,
    crewIds: shoot.crewIds,
    equipment: shoot.equipment,
    notes: shoot.notes,
    status: shoot.status,
    createdBy: shoot.createdBy,
    createdAt: shoot.createdAt.toISOString(),
    updatedAt: shoot.updatedAt.toISOString(),
  };
}
