import { db } from "@/lib/db";
import { notFound, requireField } from "@/modules/crm/shared";

export type PipelineStageInput = {
  name: string;
  order?: number;
  probability?: number;
  isWon?: boolean;
  isLost?: boolean;
};

export function listPipelineStages(organizationId: string) {
  return db.pipelineStage.findMany({
    where: { organizationId },
    orderBy: { order: "asc" },
  });
}

export async function createPipelineStage(
  organizationId: string,
  input: PipelineStageInput
) {
  requireField(input.name, "Name");
  const count = await db.pipelineStage.count({ where: { organizationId } });
  return db.pipelineStage.create({
    data: {
      organizationId,
      name: input.name,
      order: input.order ?? count,
      probability: input.probability ?? 0,
      isWon: input.isWon ?? false,
      isLost: input.isLost ?? false,
    },
  });
}

export async function updatePipelineStage(
  organizationId: string,
  id: string,
  input: Partial<PipelineStageInput>
) {
  const existing = await db.pipelineStage.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Pipeline stage");
  return db.pipelineStage.update({ where: { id }, data: input });
}

export async function deletePipelineStage(organizationId: string, id: string) {
  const existing = await db.pipelineStage.findFirst({ where: { id, organizationId } });
  if (!existing) notFound("Pipeline stage");
  await db.pipelineStage.delete({ where: { id } });
}

export async function reorderPipelineStages(
  organizationId: string,
  orderedIds: string[]
) {
  await db.$transaction([
    // Shift into a disjoint negative range first so the unique
    // [organizationId, order] constraint never collides mid-transaction.
    ...orderedIds.map((id, index) =>
      db.pipelineStage.updateMany({
        where: { id, organizationId },
        data: { order: -1 * (index + 1) },
      })
    ),
    ...orderedIds.map((id, index) =>
      db.pipelineStage.updateMany({
        where: { id, organizationId },
        data: { order: index },
      })
    ),
  ]);
}
