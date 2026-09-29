import { NextRequest, NextResponse } from 'next/server';
import { API_BASE, setAuthCookies, AdminProfile } from '@/lib/session';

/**
 * Signs in against the backend and stores both tokens in httpOnly cookies.
 * The tokens are never returned to the browser.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string };

  let upstream: Response;

  try {
    upstream = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    });
  } catch {
    // The backend is unreachable — wrong MPRNT_API_URL, or it simply is not
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

  // Resolve the shop's display name so the sidebar can show it without an
  // extra client round trip on every page load.
  let organizationName: string | null = null;
  let timezone: string | null = null;

  try {
    const me = await fetch(`${API_BASE}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${data.data.accessToken}` },
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
