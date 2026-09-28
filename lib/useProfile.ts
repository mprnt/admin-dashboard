'use client';

import React from 'react';
import { parseProfile, type AdminProfile } from '@/lib/profile';

/**
 * Reads the non-httpOnly profile cookie.
 *
 * This drives which navigation and buttons render. It is a display hint only —
 * the cookie is readable and therefore editable by anyone with devtools, so the
 * backend re-checks every permission on every request. Hiding a button the user
 * cannot use is courtesy, not security.
 */
export function useProfile(): AdminProfile | null {
  const [profile, setProfile] = React.useState<AdminProfile | null>(null);

  React.useEffect(() => {
    const match = document.cookie.split('; ').find((c) => c.startsWith('mprnt_profile='));
    if (!match) return;
    setProfile(parseProfile(match.split('=').slice(1).join('=')));
  }, []);

  return profile;
}

export function useCan(permission: string): boolean {
  const profile = useProfile();
  return Boolean(profile?.permissions.includes(permission));
}
