import { NextRequest, NextResponse } from 'next/server';
import { API_BASE, setAuthCookies, AdminProfile, relayHeaders } from '@/lib/session';
import { isSameOriginRequest } from '@/lib/security';

function sameOrigin(req: Request): boolean {
  return isSameOriginRequest({
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
    host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
  });
}

/**
 * Signs in against the backend and stores both tokens in httpOnly cookies.
 * The tokens are never returned to the browser.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ message: 'Cross-origin request refused' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  let upstream: Response;

  try {
    upstream = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      // The real client IP matters most here: it is what the login rate limit
      // and the failed-sign-in audit trail key on.
      headers: { 'Content-Type': 'application/json', ...relayHeaders(req) },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    });
  } catch {
    // The backend is unreachable - wrong MPRNT_API_URL, or it simply is not
    // running. Without this the fetch throws, Next returns a bare 500, and the
    // sign-in form tells the person their password is wrong, which sends them
    // hunting for a problem that does not exist.
    console.error(`[auth] Cannot reach the backend at ${API_BASE}`);
    return NextResponse.json(
      {
        message:
          'Cannot reach the MPrnt backend. Check that it is running and that ' +
          'MPRNT_API_URL points at it.',
      },
      { status: 503 }
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      mustChangePassword: boolean;
      user: AdminProfile;
    };
  };

  if (!upstream.ok || !data.data) {
    // Pass the backend's status through so the form can distinguish a locked
    // account (423) from bad credentials (401) and rate limiting (429).
    return NextResponse.json(
      { message: data.message || 'Unable to sign in' },
      { status: upstream.status || 500 }
    );
  }

  // This is the shop dashboard. A platform account can read every shop, and
  // the shop endpoints this site calls answer a platform token platform-wide,
  // so letting one in would show cross-shop figures on a page that implies it
  // is one shop's. The decision is made here, from what the backend itself
  // says the account is, before any cookie exists.
  if (data.data.user.role === 'super_admin' || !data.data.user.organizationId) {
    // The backend has already issued a session. Revoke it, so a refused
    // sign-in does not leave a live refresh token behind. Best effort: the
    // refusal below holds either way.
    await fetch(`${API_BASE}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...relayHeaders(req) },
      body: JSON.stringify({ refreshToken: data.data.refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);

    return NextResponse.json(
      {
        message: 'This dashboard is for shop accounts. Platform accounts sign in to the platform console.',
        code: 'PLATFORM_ACCOUNT',
      },
      { status: 403 }
    );
  }

  // Resolve the shop's display name so the sidebar can show it without an
  // extra client round trip on every page load.
  let organizationName: string | null = null;
  let timezone: string | null = null;

  try {
    const me = await fetch(`${API_BASE}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${data.data.accessToken}`, ...relayHeaders(req) },
      cache: 'no-store',
    });
    if (me.ok) {
      const body = (await me.json()) as {
        data?: { organization?: { name: string; timezone: string } | null };
      };
      organizationName = body.data?.organization?.name ?? null;
      timezone = body.data?.organization?.timezone ?? null;
    }
  } catch {
    // Non-fatal: the dashboard falls back to a generic label.
  }

  const profile: AdminProfile = {
    ...data.data.user,
    organizationName,
    timezone,
    mustChangePassword: data.data.mustChangePassword,
  };

  const res = NextResponse.json({
    ok: true,
    mustChangePassword: data.data.mustChangePassword,
    role: profile.role,
  });

  setAuthCookies(res, data.data, profile);
  return res;
}
