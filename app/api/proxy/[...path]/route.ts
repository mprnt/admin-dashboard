import { NextRequest, NextResponse } from 'next/server';
import {
  API_BASE,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  AdminProfile,
  getProfile,
} from '@/lib/session';

/**
 * Backend-for-frontend proxy.
 *
 * Every admin API call from the browser goes through here so the access token
 * can be attached server-side. Two things fall out of that:
 *
 *  - no credential is ever readable by page JavaScript;
 *  - a 401 can be handled transparently, by refreshing once and replaying the
 *    request, so a 15-minute token expiry never interrupts someone mid-task.
 *
 * Only paths under /admin are forwarded. Without that check this would be an
 * open relay to every backend route, authenticated with an admin's token.
 */

const ALLOWED_PREFIX = 'admin/';

async function refreshTokens(): Promise<{
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  profile: AdminProfile;
} | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as {
    data?: { accessToken: string; refreshToken: string; expiresIn: number };
  };
  if (!body.data) return null;

  const profile = getProfile();
  if (!profile) return null;

  return { tokens: body.data, profile };
}

async function handle(req: NextRequest, ctx: { params: { path: string[] } }) {
  const path = ctx.params.path.join('/');

  if (!path.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const search = req.nextUrl.search || '';
  const url = `${API_BASE}/${path}${search}`;

  const method = req.method;
  const hasBody = !['GET', 'HEAD'].includes(method);
  const rawBody = hasBody ? await req.text() : undefined;

  const call = (token?: string) =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: rawBody,
      cache: 'no-store',
    });

  let upstream: Response;
  try {
    upstream = await call(getAccessToken());
  } catch {
    console.error(`[proxy] Cannot reach the backend at ${API_BASE}`);
    return NextResponse.json(
      { message: 'Cannot reach the MPrnt backend. Is it running?' },
      { status: 503 }
    );
  }

  let refreshed: Awaited<ReturnType<typeof refreshTokens>> = null;

  // One transparent retry. Only on 401, and only once, so an endpoint that
  // genuinely rejects this admin does not loop.
  if (upstream.status === 401) {
    refreshed = await refreshTokens();

    if (!refreshed) {
      const res = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    upstream = await call(refreshed.tokens.accessToken);
  }

  const contentType = upstream.headers.get('content-type') || '';

  // CSV exports and other non-JSON responses stream through untouched.
  if (!contentType.includes('application/json')) {
    const blob = await upstream.arrayBuffer();
    const res = new NextResponse(blob, {
      status: upstream.status,
      headers: {
        'content-type': contentType || 'application/octet-stream',
        ...(upstream.headers.get('content-disposition')
          ? { 'content-disposition': upstream.headers.get('content-disposition') as string }
          : {}),
      },
    });
    if (refreshed) setAuthCookies(res, refreshed.tokens, refreshed.profile);
    return res;
  }

  const data = await upstream.json().catch(() => ({}));
  const res = NextResponse.json(data, { status: upstream.status });

  if (refreshed) setAuthCookies(res, refreshed.tokens, refreshed.profile);

  return res;
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
