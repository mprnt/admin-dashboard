'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Field, inputClass } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { safeNextPath } from '@/lib/security';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    params.get('expired') ? 'Your session expired. Please sign in again.' : null
  );
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        mustChangePassword?: boolean;
      };

      if (!res.ok) {
        // Distinct guidance per failure mode: a locked account and a wrong
        // password need different actions from the person reading this.
        if (res.status === 503) {
          setError(body.message || 'The MPrnt backend is not reachable right now.');
        } else if (res.status === 423) {
          setError('Too many failed attempts. This account is locked for 15 minutes.');
        } else if (res.status === 429) {
          setError('Too many sign-in attempts. Please wait a few minutes.');
        } else {
          setError(body.message || 'Sign-in failed. Check your email and password.');
        }
        setLoading(false);
        return;
      }

      // Only a same-origin path: `?next=//evil.example` must not turn a
      // fresh sign-in into a redirect to someone else's site.
      const next = safeNextPath(params.get('next'));
      router.push(body.mustChangePassword ? '/account?first=1' : next);
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-surface-secondary">
      {/* Brand panel: desktop only. On a phone it would push the form below
          the fold, and the form is the only thing anyone came here for. */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-white bg-gradient-to-br from-[#1a6240] via-[#134a31] to-[#0d3322]"
      >
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute -right-24 -bottom-24 w-[28rem] h-[28rem] rounded-full bg-white/5 blur-2xl" />

        <span className="relative flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="printer" className="w-5 h-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">MPrnt</span>
        </span>

        <div className="relative max-w-md">
          <p className="font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.05] tracking-tight">
            Every printer, every page, every rupee - at a glance.
          </p>
          <p className="mt-4 text-white/70 text-[15px] leading-relaxed">
            Revenue, printer health and the jobs that need you, in one calm place.
          </p>
        </div>

        <p className="relative text-xs text-white/50">MPrnt Admin</p>
      </aside>

      <div className="flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span
            aria-hidden="true"
            className="lg:hidden inline-flex w-11 h-11 rounded-xl bg-gradient-to-b from-primary to-primary-dark items-center justify-center text-white mb-5"
          >
            <Icon name="printer" className="w-6 h-6" />
          </span>
          <h1 className="page-title">Welcome back</h1>
          <p className="text-sm text-text-muted mt-1.5">Sign in to manage your printers.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-error/10 px-3.5 py-3 text-sm text-error"
            >
              {error}
            </div>
          )}

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-text-muted hover:text-text"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="w-[18px] h-[18px]" />
              </button>
            </div>
          </Field>

          <Button type="submit" loading={loading} className="w-full !mt-6">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs text-text-muted mt-8 pt-5 border-t border-border/70 leading-relaxed">
          Accounts are issued by your MPrnt administrator.
          <br />
          Lost your password? Ask them to reset it.
        </p>
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
      <LoginForm />
    </Suspense>
  );
}
