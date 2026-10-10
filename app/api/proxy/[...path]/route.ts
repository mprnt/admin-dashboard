import { NextRequest, NextResponse } from 'next/server';
import {
  API_BASE,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  AdminProfile,
  getProfile,
  relayHeaders,
} from '@/lib/session';
import {
  bodyNamesTenant,
  createSingleFlight,
  isSameOriginRequest,
  isShopRoute,
  isUnsafeMethod,
  resolveProxyUrl,
  SESSION_EXPIRED_HEADER,
  stripTenantParams,
} from '@/lib/security';

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
 * This is a shop dashboard, so the proxy is a narrow door, in three layers:
 *
 *  1. only paths under /admin, with no traversal out of it (resolveProxyUrl);
 *  2. only the specific method + path pairs the dashboard uses (isShopRoute),
 *     so platform routes - organizations, enrolling printers, refunds - are not
 *     reachable from this site even with a valid token;
 *  3. no request names an organization: any selector is dropped from the query
 *     and a body that carries one is refused.
 *
 * None of that is what keeps one shop out of another's data. The backend does
 * that, by deriving a shop's scope from its token. These layers make sure a
 * mistake in either place is not also a route to a platform feature.
 */

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type Refreshed = { tokens: Tokens; profile: AdminProfile } | null;

// The backend rotates the refresh token on every refresh. The overview page
// fires several requests at once; when the access token expires they all 401
// together, and without this each would spend the same refresh token, so all
// but the first would fail and sign the person out. One refresh per token runs
// at a time, and its result is reused briefly by requests still carrying the
// old cookie. Per server process; across instances the backend decides.
const refreshOnce = createSingleFlight<Tokens | null>(30_000);

async function refreshTokens(req: NextRequest): Promise<Refreshed> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const profile = getProfile();
  if (!profile) return null;

  const result = await refreshOnce(refreshToken, () => callRefresh(req, refreshToken)).catch(
    () => null
  );
  return result ? { tokens: result, profile } : null;
}

async function callRefresh(req: NextRequest, refreshToken: string): Promise<Tokens | null> {
  const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...relayHeaders(req) },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as {
    data?: Tokens;
  };
  return body.data ?? null;
}

async function handle(req: NextRequest, ctx: { params: { path: string[] } }) {
  const method = req.method;

  // Unknown routes and platform routes answer identically, so this cannot be
  // used to discover which platform endpoints exist.
  if (!isShopRoute(method, ctx.params.path)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const target = resolveProxyUrl(
    API_BASE,
    ctx.params.path,
    stripTenantParams(req.nextUrl.search || '')
  );
  if (!target) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  const url = target.toString();

  if (
    isUnsafeMethod(method) &&
    !isSameOriginRequest({
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
      host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
    })
  ) {
    return NextResponse.json({ message: 'Cross-origin request refused' }, { status: 403 });
  }
  const hasBody = !['GET', 'HEAD'].includes(method);
  const rawBody = hasBody ? await req.text() : undefined;

  if (bodyNamesTenant(rawBody)) {
    return NextResponse.json(
      { message: 'This dashboard does not select an organization' },
      { status: 400 }
    );
  }

  const call = (token?: string) =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...relayHeaders(req),
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
    refreshed = await refreshTokens(req);

    if (!refreshed) {
      const res = NextResponse.json(
        { message: 'Session expired' },
        { status: 401, headers: { [SESSION_EXPIRED_HEADER]: '1' } }
      );
      clearAuthCookies(res);
      return res;
    }

    try {
      upstream = await call(refreshed.tokens.accessToken);
    } catch {
      // The refresh already spent the old refresh token, so the new pair must
      // reach the browser even though the replay failed.
      console.error(`[proxy] Cannot reach the backend at ${API_BASE}`);
      const res = NextResponse.json(
        { message: 'Cannot reach the MPrnt backend. Is it running?' },
        { status: 503 }
      );
      setAuthCookies(res, refreshed.tokens, refreshed.profile);
      return res;
    }
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
