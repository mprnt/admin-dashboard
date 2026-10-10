/**
 * Pure request-safety checks shared by the proxy, the auth routes and the
 * login page. No Next imports, so it runs in the browser, on the server and
 * under `node --test` alike.
 */

/**
 * Builds the backend URL for a proxied path, or returns null when the path
 * must not be forwarded.
 *
 * Next hands the catch-all segments over already URL-decoded, so a request for
 * `/api/proxy/admin/%2e%2e/payments` arrives as ['admin', '..', 'payments'].
 * Checking the joined string with startsWith('admin/') would let that through,
 * and fetch would then normalise it to a non-admin backend route carrying an
 * admin's Bearer token. So every segment is checked on its own, and the final
 * URL is resolved and checked again as a second line of defence.
 */
export function resolveProxyUrl(
  apiBase: string,
  segments: string[],
  search = ''
): URL | null {
  if (segments.length < 2 || segments[0] !== 'admin') return null;

  for (const seg of segments) {
    if (!isSafeSegment(seg)) return null;
  }

  const base = apiBase.replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(`${base}/${segments.map(encodeURIComponent).join('/')}`);
  } catch {
    return null;
  }

  const allowed = new URL(`${base}/admin/`);
  if (url.origin !== allowed.origin || !url.pathname.startsWith(allowed.pathname)) {
    return null;
  }

  if (search) {
    if (!search.startsWith('?')) return null;
    url.search = search;
  }

  return url;
}

/**
 * The backend routes a shop dashboard may call - and nothing else.
 *
 * This site is for one shop looking at its own business. The backend serves a
 * far wider API, because the platform console uses it too: organizations,
 * leads, enrolling printers, rotating keys, publishing prices, refunds. A shop
 * admin's token is accepted by the backend for the routes they hold
 * permissions on, but this proxy exists to be a narrower door than that, so a
 * route absent from this list is simply not reachable from here.
 *
 * It is least privilege, not the isolation boundary. Isolation is enforced by
 * the backend, which derives a shop's scope from its token and never from the
 * request. This list is what stops a bug in either layer from also being a
 * route to a platform feature.
 *
 * Paths are relative to /admin. `:id` matches exactly one id-shaped segment.
 */
const SHOP_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['GET', 'shop'],
  ['GET', 'kiosks'],
  ['PATCH', 'kiosks/:id'],
  ['GET', 'printers'],
  ['POST', 'printers/:id/revoke'],
  ['GET', 'attention'],
  ['GET', 'reports/summary'],
  ['GET', 'reports/series'],
  ['GET', 'reports/sessions'],
  ['GET', 'reports/sessions/export'],
  ['GET', 'pricing'],
  ['GET', 'pricing/lists'],
  ['GET', 'users'],
  ['PATCH', 'users/:id'],
  ['DELETE', 'users/:id'],
  ['POST', 'users/:id/reset-password'],
  ['GET', 'audit'],
  ['GET', 'audit/actions'],
  ['POST', 'auth/change-password'],
];

/** UUIDs and printer ids: letters, digits, underscore, hyphen. */
const ID_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether this method + path (segments starting at `admin`) is a shop route. */
export function isShopRoute(method: string, segments: string[]): boolean {
  if (segments[0] !== 'admin') return false;

  const rest = segments.slice(1);
  const verb = method.toUpperCase();

  return SHOP_ROUTES.some(([routeVerb, template]) => {
    if (routeVerb !== verb) return false;

    const parts = template.split('/');
    if (parts.length !== rest.length) return false;

    return parts.every((part, i) =>
      part.startsWith(':') ? ID_SEGMENT.test(rest[i]) : part === rest[i]
    );
  });
}

/** Names a client could use to pick which organization a request is about. */
const TENANT_KEYS = new Set(['organizationid', 'organization_id', 'orgid', 'tenantid']);

/**
 * Removes any query parameter that selects an organization.
 *
 * A shop's scope comes from its token. The backend already ignores or rejects
 * these, but a shop dashboard has no reason to ever send one, so it is dropped
 * here rather than relied upon to be refused further in.
 */
export function stripTenantParams(search: string): string {
  if (!search || !search.startsWith('?')) return search || '';

  const params = new URLSearchParams(search.slice(1));
  for (const key of Array.from(params.keys())) {
    if (TENANT_KEYS.has(key.toLowerCase())) params.delete(key);
  }

  const out = params.toString();
  return out ? `?${out}` : '';
}

/**
 * True when a JSON request body tries to name an organization.
 *
 * Same reasoning as stripTenantParams, for the body: the shop dashboard never
 * sends one, so a request that does is not from this dashboard's own pages.
 */
export function bodyNamesTenant(raw: string | undefined | null): boolean {
  if (!raw) return false;

  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    return Object.keys(body as Record<string, unknown>).some((k) =>
      TENANT_KEYS.has(k.toLowerCase())
    );
  } catch {
    // Not JSON: nothing here to name an organization. The backend validates.
    return false;
  }
}

function isSafeSegment(seg: string): boolean {
  if (seg === '' || seg === '.' || seg === '..') return false;
  // Separators, a leftover escape (double-encoded input), and control
  // characters have no business in an admin route segment.
  // eslint-disable-next-line no-control-regex
  return !/[\/\\%\u0000-\u001f\u007f]/.test(seg);
}

/**
 * The post-sign-in destination taken from `?next=`, or '/' when it is not a
 * plain same-origin path. Rejects absolute URLs, protocol-relative `//host`,
 * backslash tricks (`/\host`, which browsers treat as `//host`) and anything
 * with control characters.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return '/';

  try {
    const base = 'http://same-origin.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/**
 * CSRF guard for state-changing requests: the browser's Origin (or, failing
 * that, Referer) must name this host. Every modern browser sends Origin on a
 * cross-site or non-GET fetch, so a request with neither is not from our page.
 *
 * `host` is the host the browser addressed: `x-forwarded-host` behind a proxy,
 * otherwise `host`.
 */
export function isSameOriginRequest(headers: {
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
}): boolean {
  const host = headers.host?.split(',')[0]?.trim().toLowerCase();
  if (!host) return false;

  const source = headers.origin || headers.referer;
  if (!source || source === 'null') return false;

  try {
    return new URL(source).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** HTTP methods that must pass the Origin check. */
export function isUnsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * Runs `fn` once per key at a time: concurrent callers with the same key share
 * the one in-flight promise. A settled result is kept for `ttlMs`, so a request
 * that arrives just after a refresh finished (still carrying the old cookie)
 * reuses it instead of replaying a refresh token the backend already rotated.
 */
export function createSingleFlight<T>(ttlMs: number) {
  const entries = new Map<string, { promise: Promise<T>; expires: number }>();

  return function run(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    entries.forEach((e, k) => {
      if (e.expires <= now) entries.delete(k);
    });

    const hit = entries.get(key);
    if (hit) return hit.promise;

    const promise = fn();
    const entry = { promise, expires: Infinity };
    entries.set(key, entry);
    promise.then(
      () => {
        entry.expires = Date.now() + ttlMs;
      },
      () => {
        entries.delete(key);
      }
    );
    return promise;
  };
}

/**
 * Set by the proxy on the 401 it sends when the refresh itself failed, i.e.
 * the session is really over. A 401 without it is the backend rejecting the
 * request on its merits, and must reach the page as an error, not as a
 * sign-out. (A wrong current password on change-password is now a 400
 * INVALID_CURRENT_PASSWORD, so it never reaches the refresh path at all.)
 */
export const SESSION_EXPIRED_HEADER = 'x-mprnt-session-expired';

export function isSessionExpired(res: {
  status: number;
  headers: { get(name: string): string | null };
}): boolean {
  return res.status === 401 && res.headers.get(SESSION_EXPIRED_HEADER) === '1';
}

/** Backend code on admin routes while the account still has a temporary password. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';
export const PASSWORD_CHANGE_PATH = '/account?first=1';

/**
 * Where to send the person when a response says they must change their
 * password first, or null. Already on the account page, nothing is returned:
 * that page's own side calls (e.g. the sidebar badge) may still get the 403,
 * and redirecting there would only reload the page they need.
 */
export function passwordChangeRedirect(
  status: number,
  body: unknown,
  pathname: string
): string | null {
  const code = (body as { code?: unknown } | null)?.code;
  if (status !== 403 || code !== PASSWORD_CHANGE_REQUIRED) return null;
  return pathname.startsWith('/account') ? null : PASSWORD_CHANGE_PATH;
}
