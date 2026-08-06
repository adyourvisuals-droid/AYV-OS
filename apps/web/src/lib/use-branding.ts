'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

export interface OrgBranding {
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  country: string | null;
  postalCode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankUpiId: string | null;
  currency: string;
}

/** Letterhead data for printable documents — cached process-wide since it rarely changes within a session. */
let cached: OrgBranding | null = null;

export function useBranding() {
  const [branding, setBranding] = useState<OrgBranding | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    api
      .get<OrgBranding>('/org/branding')
      .then((data) => {
        if (cancelled) return;
        cached = data;
        setBranding(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { branding, loading };
}
