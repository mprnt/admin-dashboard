'use client';

import React from 'react';

/**
 * The organization a super admin is currently looking at.
 *
 * A super admin sees every shop by default. Choosing one here pins every page
 * to that shop - the same view its owner has - without impersonating anyone:
 * requests are still made as the super admin, just filtered, so the audit
 * trail stays truthful about who looked.
 *
 * Shop staff never see the switcher, and the backend ignores the parameter for
 * them anyway: their scope comes from their token, not from anything the
 * browser sends.
 *
 * Persisted per device in localStorage. That is a view preference, not account
 * state, so it does not need to follow the person between machines.
 */

export interface ScopedOrg {
  id: string;
  name: string;
}

interface ScopeContextValue {
  org: ScopedOrg | null;
  setOrg: (org: ScopedOrg | null) => void;
}

const ScopeContext = React.createContext<ScopeContextValue>({
  org: null,
  setOrg: () => undefined,
});

const STORAGE_KEY = 'mprnt-scope-org';

export function ScopeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [org, setOrgState] = React.useState<ScopedOrg | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrgState(JSON.parse(raw) as ScopedOrg);
    } catch {
      // Storage unavailable (private mode, blocked site data): start unscoped.
    }
  }, [enabled]);

  const setOrg = React.useCallback((next: ScopedOrg | null) => {
    setOrgState(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-fatal: the choice simply won't survive a reload.
    }
  }, []);

  const value = React.useMemo(
    () => ({ org: enabled ? org : null, setOrg }),
    [enabled, org, setOrg]
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  return React.useContext(ScopeContext);
}

/** Add `organizationId` to a path's query string unless it already has one. */
export function withScope(path: string, orgId: string | null | undefined): string {
  if (!orgId || /[?&]organizationId=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}organizationId=${encodeURIComponent(orgId)}`;
}
