import type { Organization } from '../../../generated/prisma';

/** The subset of Organization safe to show on a printed document letterhead — no internal settings/flags. */
export function presentBranding(org: Organization) {
  return {
    name: org.name,
    legalName: org.legalName,
    logoUrl: org.logoUrl,
    website: org.website,
    email: org.email,
    phone: org.phone,
    addressLine1: org.addressLine1,
    addressLine2: org.addressLine2,
    city: org.city,
    state: org.state,
    stateCode: org.stateCode,
    country: org.country,
    postalCode: org.postalCode,
    gstNumber: org.gstNumber,
    panNumber: org.panNumber,
    bankName: org.bankName,
    bankAccountName: org.bankAccountName,
    bankAccountNumber: org.bankAccountNumber,
    bankIfscCode: org.bankIfscCode,
    bankUpiId: org.bankUpiId,
    currency: org.currency,
  };
}

export function presentOrganizationProfile(org: Organization) {
  return {
    ...presentBranding(org),
    id: org.id,
    slug: org.slug,
  };
}
