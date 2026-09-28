'use client';

/**
 * Client-side API access.
 *
 * Everything goes through /api/proxy, which attaches the access token on the
 * server. No token is ever available to this code, by design.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/proxy/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  if (res.status === 401) {
    // The proxy already tried to refresh. Reaching here means the session is
    // genuinely over, so send them to sign in rather than showing an error.
    if (typeof window !== 'undefined') window.location.href = '/login?expired=1';
    throw new ApiError('Session expired', 401);
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      (body as { message?: string }).message || `Request failed (${res.status})`,
      res.status
    );
  }

  return (body as { data: T }).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export type Period = 'day' | 'week' | 'month' | 'year';

export interface Range {
  from: string;
  to: string;
  timezone: string;
  period: Period;
}

export interface Summary {
  totalJobs: number;
  paidJobs: number;
  completedJobs: number;
  failedJobs: number;
  inProgressJobs: number;
  sessions: number;
  revenue: number;
  pagesCharged: number;
  pagesPrinted: number;
  colorPages: number;
  bwPages: number;
  avgPrintSeconds: number;
  fulfilmentRate: number | null;
  averageOrderValue: number;
}

export interface SeriesPoint {
  date: string;
  jobs: number;
  completed: number;
  failed: number;
  revenue: number;
  pages: number;
}

export interface SessionRow {
  jobId: string;
  sessionCode: string | null;
  kiosk: { code: string; name: string };
  printer: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
  status: string;
  paymentStatus: string;
  settings: { colorMode: string; printSides: string; copies: number };
  pages: { charged: number; printed: number; sheets: number };
  amount: number;
  pricePerPage: number;
  durationSeconds: number | null;
  errorMessage: string | null;
}

export interface PrinterRow {
  printerId: string;
  name: string;
  status: string;
  kiosk: { code: string; name: string };
  lastHeartbeat: string | null;
  secondsSinceHeartbeat: number | null;
  activeJobs: number;
  paperLevel: number | null;
  inkLevelBlack: number | null;
  capabilities: { color: boolean; doubleSided: boolean };
}

export interface AttentionRow {
  jobId: string;
  status: string;
  queueStatus: string | null;
  amount: number;
  kiosk: { code: string; name: string };
  createdAt: string;
  ageSeconds: number;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  refundCandidate: boolean;
}

export interface KioskRow {
  id: string;
  kioskId: string;
  name: string;
  location: string;
  status: string;
  organizationId: string | null;
  organizationName: string | null;
  printersOnline: number;
  printersTotal: number;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  kioskCount?: number;
  adminCount?: number;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: 'super_admin' | 'owner' | 'manager' | 'viewer';
  organizationId: string | null;
  organizationName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface AuditRow {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { email: string; name: string | null } | null;
}

export interface PriceListRow {
  id: string;
  scope: 'platform' | 'organization' | 'kiosk';
  organizationId: string | null;
  organizationName: string | null;
  kioskId: string | null;
  kioskCode: string | null;
  bwPerPage: number;
  colorPerPage: number;
  minCharge: number;
  effectiveFrom: string;
  createdAt: string;
}
