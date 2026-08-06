import type { Prisma } from '../../../generated/prisma';

export const CREDENTIAL_CATEGORIES = ['SOCIAL', 'ADS', 'HOSTING', 'DOMAIN', 'EMAIL', 'CMS', 'ANALYTICS', 'OTHER'] as const;

/** List/detail view WITHOUT the secret — never send ciphertext or plaintext in a list response. */
export function presentCredential(credential: {
  id: string;
  service: string;
  category: string | null;
  loginUrl: string | null;
  username: string | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: credential.id,
    service: credential.service,
    category: credential.category,
    loginUrl: credential.loginUrl,
    username: credential.username,
    notes: credential.notes,
    createdBy: credential.createdBy,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

export const CREDENTIAL_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ClientCredentialInclude;
