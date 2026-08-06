import type { Prisma } from '../../../generated/prisma';

export const ASSET_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOGO', 'FONT', 'OTHER'] as const;

export const ASSET_INCLUDE = {
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.AssetInclude;

type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof ASSET_INCLUDE }>;

export function presentAsset(asset: AssetWithRelations) {
  return {
    id: asset.id,
    name: asset.name,
    clientId: asset.clientId,
    fileUrl: asset.fileUrl,
    mimeType: asset.mimeType,
    tags: asset.tags,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt.toISOString(),
  };
}
