/**
 * Profile shape and parsing, shared by server and client.
 *
 * Deliberately separate from lib/session.ts: that module imports next/headers,
 * which cannot be pulled into a client component. Keeping the pure parts here
 * lets both sides share one implementation.
 */

export interface AdminProfile {
  id: string;
  email: string;
  role: 'super_admin' | 'owner' | 'manager' | 'viewer';
  organizationId: string | null;
  /** Shop name, for the sidebar. Resolved at sign-in from /auth/me. */
  organizationName?: string | null;
  timezone?: string | null;
  permissions: string[];
  mustChangePassword?: boolean;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Tolerates a value that is either plain JSON or percent-encoded, so a cookie
 * written by an older build still parses instead of signing the person out.
 */
export function parseProfile(raw: string | undefined): AdminProfile | null {
  if (!raw) return null;

  for (const candidate of [raw, safeDecode(raw)]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as AdminProfile;
    } catch {
      // try the next form
    }
  }

  return null;
}
