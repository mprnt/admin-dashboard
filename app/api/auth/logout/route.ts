import { NextResponse } from 'next/server';
import { API_BASE, clearAuthCookies, getRefreshToken, relayHeaders } from '@/lib/session';

export async function POST(req: Request) {
  const refreshToken = getRefreshToken();

  // Tell the backend to revoke the refresh token, then clear locally. A failure
  // upstream must not leave the browser holding a session it thinks is valid,
  // so the cookies are cleared either way.
  if (refreshToken) {
    await fetch(`${API_BASE}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...relayHeaders(req) },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
