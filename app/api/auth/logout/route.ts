import { NextResponse } from 'next/server';
import { API_BASE, clearAuthCookies, getRefreshToken, relayHeaders } from '@/lib/session';
import { isSameOriginRequest } from '@/lib/security';

function sameOrigin(req: Request): boolean {
  return isSameOriginRequest({
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
    host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
  });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ message: 'Cross-origin request refused' }, { status: 403 });
  }

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
