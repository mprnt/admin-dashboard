'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Field, inputClass } from '@/components/ui';
import { Icon } from '@/components/Icon';

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

      const next = params.get('next');
      router.push(body.mustChangePassword ? '/account?first=1' : next || '/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-surface-secondary">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span
            aria-hidden="true"
            className="inline-flex w-12 h-12 rounded-xl bg-primary items-center justify-center text-white mb-3"
          >
            <Icon name="printer" className="w-7 h-7" />
          </span>
          <h1 className="text-2xl font-bold text-text">MPrnt Admin</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to manage your kiosks</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-surface border border-border rounded-xl shadow-sm p-5 sm:p-6 space-y-4"
          noValidate
        >
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-error/30 bg-error/10 px-3 py-2.5 text-sm text-error"
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
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-text-muted hover:text-text"
              >
                {showPassword ? (
                  <Icon name="moon" className="w-4 h-4" />
                ) : (
                  <Icon name="sun" className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs text-text-muted text-center mt-5">
          Accounts are issued by your MPrnt administrator.
          <br />
          Lost your password? Ask them to reset it.
        </p>
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
