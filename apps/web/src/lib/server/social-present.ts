import type { Prisma } from '../../../generated/prisma';

export const POST_STATUSES = [
  'IDEA',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
] as const;

export const SOCIAL_PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'YOUTUBE',
  'X',
  'GOOGLE_BUSINESS',
] as const;

export const SOCIAL_POST_INCLUDE = {
  client: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  author: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.SocialPostInclude;

type SocialPostWithRelations = Prisma.SocialPostGetPayload<{ include: typeof SOCIAL_POST_INCLUDE }>;

export function presentSocialPost(post: SocialPostWithRelations) {
  return {
    id: post.id,
    client: post.client,
    campaign: post.campaign,
    author: post.author,
    platforms: post.platforms,
    caption: post.caption,
    hashtags: post.hashtags,
    mediaUrls: post.mediaUrls,
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    failureReason: post.failureReason,
    reach: post.reach,
    impressions: post.impressions,
    engagement: post.engagement,
    clicks: post.clicks,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

/** Campaign.clientId is a loose reference, not a Prisma relation — no include needed. */
export function presentCampaign(campaign: {
  id: string;
  name: string;
  clientId: string | null;
  platform: string | null;
  objective: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  budget: Prisma.Decimal | null;
  spend: Prisma.Decimal;
  currency: string;
  createdAt: Date;
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    clientId: campaign.clientId,
    platform: campaign.platform,
    objective: campaign.objective,
    status: campaign.status,
    startDate: campaign.startDate?.toISOString() ?? null,
    endDate: campaign.endDate?.toISOString() ?? null,
    budget: campaign.budget ? Number(campaign.budget) : null,
    spend: Number(campaign.spend),
    currency: campaign.currency,
    createdAt: campaign.createdAt.toISOString(),
  };
}
