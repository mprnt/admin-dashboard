'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * The organization a super admin is currently looking at.
 *
 * A super admin sees every shop by default. Choosing one narrows the
 * operational pages to that shop - the same view its owner has - without
 * impersonating anyone: requests are still made as the super admin, just
 * filtered, so the audit trail stays truthful about who looked.
 *
 * The filter only applies on SCOPED_ROUTES, the pages that show the picker.
 * Elsewhere (staff, pricing, partners, leads) a remembered shop would filter
 * data with nothing on screen saying so, which is worse than no filter.
 *
 * Held in memory for the session, not persisted: a shop chosen yesterday
 * silently narrowing today's figures is exactly the surprise to avoid.
 *
 * Shop staff never see the switcher, and the backend ignores the parameter for
 * them anyway: their scope comes from their token, not from anything the
 * browser sends.
 */

export interface ScopedOrg {
  id: string;
  name: string;
}

interface ScopeContextValue {
  /** The chosen shop, or null when the current page is not filterable. */
  org: ScopedOrg | null;
  setOrg: (org: ScopedOrg | null) => void;
  /** Whether the current page offers the shop filter at all. */
  available: boolean;
}

const ScopeContext = React.createContext<ScopeContextValue>({
  org: null,
  setOrg: () => undefined,
  available: false,
});

/** Pages where narrowing to one shop is meaningful. Exact paths only. */
export const SCOPED_ROUTES = ['/', '/sessions', '/printers', '/attention', '/audit'];

/** Written by earlier builds; cleared so an old choice cannot resurface. */
const LEGACY_STORAGE_KEY = 'mprnt-scope-org';

export function ScopeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [org, setOrg] = React.useState<ScopedOrg | null>(null);

  React.useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }, []);

  const available = enabled && SCOPED_ROUTES.includes(pathname);

  const value = React.useMemo(
    () => ({ org: available ? org : null, setOrg, available }),
    [available, org]
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
