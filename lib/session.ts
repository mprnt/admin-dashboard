import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseProfile, type AdminProfile } from '@/lib/profile';

export type { AdminProfile };
export { parseProfile };

/**
 * Token handling for the admin dashboard.
 *
 * Both tokens live in httpOnly cookies and are attached by route handlers on
 * the server. Browser JavaScript never sees either one, so an XSS bug in this
 * dashboard cannot exfiltrate a credential that reads every shop's revenue.
 *
 * That is why the app talks to /api/proxy/* rather than to the backend
 * directly: the proxy is where the Bearer header gets added.
 */

export const ACCESS_COOKIE = 'mprnt_at';
export const REFRESH_COOKIE = 'mprnt_rt';
export const PROFILE_COOKIE = 'mprnt_profile';

function resolveApiBase(): string {
  const raw = (process.env.MPRNT_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

  // A plain-http remote host is almost always a typo, and it fails in a way
  // that is hard to read: the host 301s to https, fetch downgrades POST to GET
  // and drops the body, and the request lands on whatever GET route matches —
  // for /admin/auth/login that is the auth middleware, so a sign-in attempt
  // comes back "Authentication required" instead of anything about the URL.
  if (raw.startsWith('http://')) {
    const host = raw.slice('http://'.length).split('/')[0].split(':')[0];
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

    if (!isLocal) {
      console.warn(`[config] MPRNT_API_URL is http:// for a remote host; upgrading to https:// — ${host}`);
      return 'https://' + raw.slice('http://'.length);
    }
  }

  return raw;
}

export const API_BASE = resolveApiBase();

const isProduction = process.env.NODE_ENV === 'production';

const baseCookie = {
  httpOnly: true,
  // Only sent over HTTPS in production; plain http is needed for local dev.
  secure: isProduction,
  // 'lax' still sends the cookie on top-level navigation, which is what makes
  // a bookmarked dashboard URL work, while blocking cross-site form posts.
  sameSite: 'lax' as const,
  path: '/',
};


export function setAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  profile: AdminProfile
): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookie,
    maxAge: tokens.expiresIn,
  });

  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    maxAge: 7 * 24 * 60 * 60,
  });

  // Readable by the client so the UI can render the right navigation without a
  // round trip. Deliberately NOT httpOnly, and deliberately carries no secret:
  // it is a display hint. Every actual permission check happens on the server.
  // Not pre-encoded: Next's cookie API percent-encodes on write and decodes on
  // read. Encoding here too would double-encode, and a single decode on the
  // client would then leave escaped JSON that cannot be parsed.
  res.cookies.set(PROFILE_COOKIE, JSON.stringify(profile), {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, PROFILE_COOKIE]) {
    res.cookies.set(name, '', { ...baseCookie, httpOnly: name !== PROFILE_COOKIE, maxAge: 0 });
  }
}

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}

export function getProfile(): AdminProfile | null {
  return parseProfile(cookies().get(PROFILE_COOKIE)?.value);
}

/**
 * Tolerates a value that is either plain JSON or percent-encoded, so a cookie
 * written by an older build still parses instead of signing the person out.
 */


/**
 * Server-side fetch against the backend with the access token attached.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<Response> {
  const accessToken = token ?? getAccessToken();

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
}

/**
 * Headers that let the backend attribute a relayed request to the admin who
 * made it, rather than to this server.
 *
 * Every admin request reaches the backend from this server, so without these
 * the backend would record one IP for every admin in every shop — sharing one
 * rate-limit bucket between all of them, and making the audit log's IP column
 * meaningless. The shared secret is what lets the backend believe the claimed
 * IP; see mprnt-backend/src/middleware/trustedProxy.ts.
 *
 * Client IP source: `x-real-ip`, then the first `x-forwarded-for` entry. On
 * Vercel both are set by the platform and cannot be supplied by the browser. On
 * another host, confirm its proxy overwrites these rather than appending to a
 * client-supplied value.
 */
export function relayHeaders(req: Request): Record<string, string> {
  const secret = process.env.MPRNT_PROXY_SECRET;
  if (!secret) return {};

  const ip =
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  return {
    'X-MPrnt-Proxy-Secret': secret,
    ...(ip ? { 'X-MPrnt-Client-IP': ip } : {}),
  };
}
