'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { AdminProfile } from '@/lib/profile';

/**
 * Application shell.
 *
 * Navigation adapts rather than just shrinking:
 *  - lg and up: a persistent sidebar, since a dashboard is a place you stay;
 *  - below lg: a bottom tab bar for the five most-used destinations, with the
 *    rest behind a "More" sheet. Bottom placement is deliberate — on a phone
 *    held one-handed, the top of the screen is the hardest place to reach.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof import('@/components/Icon').icons;
  permission?: string;
  superAdminOnly?: boolean;
  /** Shown in the mobile tab bar rather than the More sheet. */
  primary?: boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'home', primary: true },
  { href: '/sessions', label: 'Sessions', icon: 'receipt', permission: 'sessions:read', primary: true },
  { href: '/printers', label: 'Printers', icon: 'printer', permission: 'printers:read', primary: true },
  { href: '/attention', label: 'Attention', icon: 'alert', permission: 'reports:read', primary: true },
  { href: '/pricing', label: 'Pricing', icon: 'tag', permission: 'pricing:read' },
  { href: '/staff', label: 'Staff', icon: 'users', permission: 'staff:read' },
  { href: '/organizations', label: 'Organizations', icon: 'building', superAdminOnly: true },
  { href: '/audit', label: 'Audit log', icon: 'shield', permission: 'audit:read' },
];

export function visibleNav(profile: AdminProfile): NavItem[] {
  return NAV.filter((item) => {
    if (item.superAdminOnly && profile.role !== 'super_admin') return false;
    if (item.permission && !profile.permissions.includes(item.permission)) return false;
    return true;
  });
}

export function Shell({
  profile,
  children,
}: {
  profile: AdminProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const items = visibleNav(profile);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const secondary = items.filter((i) => !primary.includes(i));

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  async function signOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const scopeLabel =
    profile.role === 'super_admin' ? 'Platform' : profile.organizationName || 'Your shop';

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-sidebar flex-col bg-surface border-r border-border"
      >
        <div className="h-header flex items-center gap-2 px-5 border-b border-border">
          <Logo />
        </div>

        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {profile.role === 'super_admin' ? 'Signed in as' : 'Shop'}
          </p>
          <p className="text-sm font-bold text-text truncate mt-0.5">{scopeLabel}</p>
          <p className="text-xs text-text-muted truncate">{profile.email}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary/10 text-accent'
                      : 'text-text-muted hover:text-text hover:bg-surface-secondary'
                  }`}
                >
                  <Icon name={item.icon} className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/account"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:text-text hover:bg-surface-secondary"
          >
            <Icon name="cog" className="w-5 h-5" />
            Account
          </Link>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:text-error hover:bg-surface-secondary"
          >
            <Icon name="logout" className="w-5 h-5" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ---------------- Top bar ---------------- */}
      <header className="lg:pl-sidebar sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border">
        <div className="h-header flex items-center justify-between gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo compact />
          </div>

          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-semibold text-text truncate">
              {items.find((i) => isActive(i.href))?.label ?? 'Dashboard'}
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {profile.role === 'super_admin' && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-accent text-xs font-semibold">
                Super admin
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ---------------- Main ---------------- */}
      <main
        id="main"
        tabIndex={-1}
        className="lg:pl-sidebar pb-[calc(var(--mobile-nav-height)+1rem)] lg:pb-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">{children}</div>
      </main>

      {/* ---------------- Mobile tab bar ---------------- */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border"
        aria-label="Main navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex items-stretch h-mobile-nav">
          {primary.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive(item.href) ? 'text-accent' : 'text-text-muted'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className="w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-text-muted"
            >
              <Icon name="menu" className="w-5 h-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ---------------- Mobile "More" sheet ---------------- */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="absolute bottom-0 inset-x-0 bg-surface rounded-t-2xl border-t border-border p-4 animate-in"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" aria-hidden="true" />

            <div className="px-1 pb-3 border-b border-border">
              <p className="text-sm font-bold text-text truncate">{scopeLabel}</p>
              <p className="text-xs text-text-muted truncate">{profile.email}</p>
            </div>

            <ul className="py-2">
              {secondary.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-2 py-3 rounded-lg text-sm font-medium ${
                      isActive(item.href) ? 'text-accent bg-primary/10' : 'text-text'
                    }`}
                  >
                    <Icon name={item.icon} className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/account"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-2 py-3 rounded-lg text-sm font-medium text-text"
                >
                  <Icon name="cog" className="w-5 h-5" />
                  Account
                </Link>
              </li>
            </ul>

            <button
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-lg text-sm font-semibold text-error border-t border-border mt-1"
            >
              <Icon name="logout" className="w-5 h-5" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white"
      >
        <Icon name="printer" className="w-5 h-5" />
      </span>
      <span className="font-bold text-text">
        MPrnt
        {!compact && <span className="text-text-muted font-medium"> Admin</span>}
      </span>
    </span>
  );
}
