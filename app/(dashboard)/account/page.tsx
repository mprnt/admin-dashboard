'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Card, CardHeader, Button, Field, inputClass, Toast } from '@/components/ui';
import { useProfile } from '@/lib/useProfile';

function AccountContent() {
  const profile = useProfile();
  const params = useSearchParams();
  const router = useRouter();
  const isFirstSignIn = params.get('first') === '1';

  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next.length < 12) {
      setError('Your new password must be at least 12 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setToast('Password changed. Signing you out…');
      // Changing a password revokes every session, including this one, so a
      // fresh sign-in is required rather than optional.
      setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
      }, 1200);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change the password');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="page-title">Account</h1>
        <p className="text-sm text-text-muted mt-1.5">{profile?.email}</p>
      </div>

      {isFirstSignIn && (
        <Card className="p-4 border-warning/40 bg-warning/5">
          <p className="font-semibold text-text">Choose your own password</p>
          <p className="text-sm text-text-muted mt-0.5">
            You signed in with a temporary password issued by your administrator. Replace it
            before you carry on.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title="Your details" />
        <dl className="p-4 sm:p-5 space-y-3">
          <div className="flex justify-between gap-3">
            <dt className="text-sm text-text-muted">Email</dt>
            <dd className="text-sm font-semibold text-text truncate">{profile?.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sm text-text-muted">Role</dt>
            <dd className="text-sm font-semibold text-text capitalize">
              {profile?.role.replace('_', ' ')}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sm text-text-muted">Permissions</dt>
            <dd className="text-sm font-semibold text-text">{profile?.permissions.length ?? 0}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Change password" />
        <form onSubmit={submit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          <Field label="Current password" htmlFor="cur">
            <input id="cur" type="password" autoComplete="current-password" required
              value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
          </Field>

          <Field label="New password" htmlFor="new" hint="At least 12 characters. Length matters more than symbols.">
            <input id="new" type="password" autoComplete="new-password" required
              value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm">
            <input id="confirm" type="password" autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </Field>

          <p className="text-xs text-text-muted">
            Changing your password signs you out everywhere, including here.
          </p>

          <Button type="submit" loading={saving}>Change password</Button>
        </form>
      </Card>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 w-full" />}>
      <AccountContent />
    </Suspense>
  );
}
