'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SupportCard } from '@/components/ContactSupport';
import { useApi } from '@/lib/useApi';
import type { AdminProfile } from '@/lib/profile';

/**
 * Application shell.
 *
 * Navigation adapts rather than just shrinking:
 *  - lg and up: a persistent sidebar, since a dashboard is a place you stay;
 *  - below lg: a floating bottom tab bar for the four most-used destinations,
 *    with the rest behind a "More" sheet. Bottom placement is deliberate - on
 *    a phone held one-handed, the top of the screen is the hardest place to
 *    reach.
 *
 * Destinations are grouped by intent: "Operate" is the day-to-day (is money
 * coming in, is anything broken), "Manage" is configuration you touch rarely.
 * Attention carries a live count so a problem is visible from any page.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof import('@/components/Icon').icons;
  permission?: string;
  /** Shown in the mobile tab bar rather than the More sheet. */
  primary?: boolean;
  group: 'operate' | 'manage';
}

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'home', primary: true, group: 'operate' },
  { href: '/sessions', label: 'Sessions', icon: 'receipt', permission: 'sessions:read', primary: true, group: 'operate' },
  { href: '/printers', label: 'Printers', icon: 'printer', permission: 'printers:read', primary: true, group: 'operate' },
  { href: '/attention', label: 'Attention', icon: 'alert', permission: 'reports:read', primary: true, group: 'operate' },
  { href: '/pricing', label: 'Pricing', icon: 'tag', permission: 'pricing:read', group: 'manage' },
  { href: '/staff', label: 'Staff', icon: 'users', permission: 'staff:read', group: 'manage' },
  { href: '/shop', label: 'Your shop', icon: 'building', permission: 'reports:read', group: 'manage' },
  { href: '/audit', label: 'Audit log', icon: 'shield', permission: 'audit:read', group: 'manage' },
];

const GROUP_LABEL: Record<NavItem['group'], string> = {
  operate: 'Operate',
  manage: 'Manage',
};

export function visibleNav(profile: AdminProfile): NavItem[] {
  return NAV.filter((item) => {
    if (item.permission && !profile.permissions.includes(item.permission)) return false;
    return true;
  });
}

export function Shell({
  profile,
  remoteApi,
  children,
}: {
  profile: AdminProfile;
  /** Set only when a dev build is talking to a backend elsewhere. */
  remoteApi?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const items = visibleNav(profile);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const secondary = items.filter((i) => !primary.includes(i));

  // Live count for the Attention badge. Refetched on navigation so it clears
  // soon after someone deals with the queue.
  const canSeeAttention = profile.permissions.includes('reports:read');
  const attention = useApi<{ count: number }>(canSeeAttention ? '/attention' : null, [pathname]);
  const badges: Record<string, number> = { '/attention': attention.data?.count ?? 0 };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  React.useEffect(() => setMoreOpen(false), [pathname]);

  React.useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  async function signOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const scopeLabel = profile.organizationName || 'Your shop';
  const roleLabel = ROLE_LABEL[profile.role] ?? profile.role;

  const groups = (['operate', 'manage'] as const)
    .map((g) => ({ id: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-sidebar flex-col border-r border-border/60">
        <div className="h-header flex items-center px-5">
          <Logo />
        </div>

        <div className="px-3 pt-1 pb-3">
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-text/5 transition-colors"
          >
            <Avatar name={scopeLabel} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text truncate">{scopeLabel}</span>
              <span className="block text-xs text-text-muted truncate">{roleLabel}</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.id} className="mt-3 first:mt-1">
              <p className="eyebrow px-3 mb-1.5">{GROUP_LABEL[group.id]}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const badge = badges[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-surface text-text font-semibold shadow-card'
                            : 'text-text-muted font-medium hover:text-text hover:bg-text/5'
                        }`}
                      >
                        <Icon
                          name={item.icon}
                          className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-accent' : ''}`}
                        />
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && <CountBadge count={badge} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* MPrnt's contact details in reach from every page; refunds and
            pricing are things only MPrnt can do for a shop. */}
        <div className="px-3 pb-3">
          <SupportCard compact />
        </div>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              aria-current={isActive('/account') ? 'page' : undefined}
              className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text hover:bg-text/5"
            >
              <Icon name="cog" className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">{profile.email}</span>
            </Link>
            <button
              onClick={signOut}
              disabled={signingOut}
              title="Sign out"
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-error hover:bg-text/5"
            >
              <Icon name="logout" className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- Top bar ----------------
          Holds preferences. The page's own title lives in the page, so it is not
          repeated here, and the shop's name is in the sidebar. */}
      <header className="lg:pl-sidebar sticky top-0 z-30 glass border-b border-border/60">
        <div className="h-header max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-8">
          <div className="lg:hidden">
            <Logo compact />
          </div>

          <div className="flex-1" />

          <ThemeToggle />
        </div>
      </header>

      {/* A dev server pointed at a deployed backend looks identical to one
          pointed at localhost, and every action here is real. */}
      {remoteApi && (
        <div role="status" className="lg:pl-sidebar bg-warning text-surface">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-1.5 flex items-center gap-2 text-xs font-semibold">
            <Icon name="alert" className="w-4 h-4 flex-shrink-0" />
            <span>
              Local dashboard connected to <span className="font-mono">{remoteApi}</span> — changes
              here affect that backend, not your machine.
            </span>
          </div>
        </div>
      )}

      {/* ---------------- Main ---------------- */}
      <main
        id="main"
        tabIndex={-1}
        className="lg:pl-sidebar pb-[calc(var(--mobile-nav-height)+2.5rem+env(safe-area-inset-bottom))] lg:pb-12 outline-none"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10">{children}</div>
      </main>

      {/* ---------------- Mobile tab bar ----------------
          Floats above the content with a gap, so it reads as a control rather
          than part of the page, and clears the iOS home indicator. */}
      <nav
        className="lg:hidden fixed inset-x-3 z-30"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        aria-label="Main navigation"
      >
        <ul className="glass flex items-stretch h-mobile-nav rounded-2xl border border-border/70 shadow-float px-1">
          {primary.map((item) => {
            const active = isActive(item.href);
            const badge = badges[item.href];
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                    active ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  <span
                    className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                      active ? 'bg-primary/15' : ''
                    }`}
                  >
                    <Icon name={item.icon} className="w-5 h-5" />
                    {badge > 0 && (
                      <span className="absolute -top-1 right-1">
                        <CountBadge count={badge} small />
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={`w-full h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                secondary.some((i) => isActive(i.href)) ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <span className="flex items-center justify-center w-12 h-7">
                <Icon name="menu" className="w-5 h-5" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ---------------- Mobile "More" sheet ---------------- */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="absolute bottom-0 inset-x-0 bg-surface rounded-t-[1.5rem] shadow-float p-4 animate-sheet"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" aria-hidden="true" />

            <Link
              href="/account"
              className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3"
            >
              <Avatar name={scopeLabel} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text truncate">{scopeLabel}</span>
                <span className="block text-xs text-text-muted truncate">{profile.email}</span>
              </span>
              <Icon name="chevronRight" className="w-4 h-4 text-text-muted" />
            </Link>

            {secondary.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 mt-3">
                {secondary.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex flex-col gap-3 p-3.5 rounded-2xl border text-sm font-medium transition-colors ${
                          active
                            ? 'border-accent/40 bg-primary/10 text-accent'
                            : 'border-border text-text hover:bg-surface-secondary'
                        }`}
                      >
                        <Icon name={item.icon} className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3">
              <SupportCard />
            </div>

            <button
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center justify-center gap-2 mt-3 py-3 rounded-2xl text-sm font-medium text-error hover:bg-error/10 min-h-[44px]"
            >
              <Icon name="logout" className="w-4 h-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  viewer: 'Viewer',
};

function CountBadge({ count, small = false }: { count: number; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-warning text-surface font-semibold tabular ${
        small ? 'min-w-[16px] h-4 px-1 text-[10px]' : 'min-w-[20px] h-5 px-1.5 text-[11px]'
      }`}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only"> need attention</span>
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[13px] font-semibold text-white bg-gradient-to-br from-primary-light to-primary-dark"
    >
      {initials || 'M'}
    </span>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-primary to-primary-dark flex items-center justify-center text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]"
      >
        <Icon name="printer" className="w-[18px] h-[18px]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-text">
        MPrnt
        {!compact && <span className="text-text-muted font-normal"> Admin</span>}
      </span>
    </span>
  );
}
