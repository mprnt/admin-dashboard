import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bodyNamesTenant,
  createSingleFlight,
  isSameOriginRequest,
  isShopRoute,
  isSessionExpired,
  PASSWORD_CHANGE_PATH,
  passwordChangeRedirect,
  resolveProxyUrl,
  SESSION_EXPIRED_HEADER,
  safeNextPath,
  stripTenantParams,
} from '../lib/security.ts';

const BASE = 'https://api.example.test/api/v1';

// Next decodes catch-all segments, so `%2e%2e` in the request URL arrives here
// as '..'. Both forms are covered.
const decode = (p: string) => p.split('/').map(decodeURIComponent);

test('proxy forwards plain admin paths', () => {
  assert.equal(
    resolveProxyUrl(BASE, ['admin', 'reports', 'summary'], '?period=7d')?.toString(),
    `${BASE}/admin/reports/summary?period=7d`
  );
  assert.equal(
    resolveProxyUrl(BASE, ['admin', 'printers', 'abc-123', 'rotate-key'])?.toString(),
    `${BASE}/admin/printers/abc-123/rotate-key`
  );
});

test('proxy rejects traversal out of /admin', () => {
  for (const raw of [
    'admin/%2e%2e/payments',
    'admin/%2E%2E/%2e%2e/health',
    'admin/../payments',
    'admin/./auth/me',
    'admin/%2e',
    'admin/reports/%2e%2e/%2e%2e/sessions',
  ]) {
    assert.equal(resolveProxyUrl(BASE, decode(raw)), null, raw);
  }
});

test('proxy rejects encoded separators and double encoding', () => {
  for (const segs of [
    ['admin', '..%2fpayments'], // %252f decoded once
    ['admin', 'a/b'], // %2f decoded
    ['admin', 'a\\..\\b'], // backslashes
    ['admin', '%2e%2e'], // double-encoded dots
    ['admin', ''],
    ['admin', 'x\u0000'],
  ]) {
    assert.equal(resolveProxyUrl(BASE, segs), null, JSON.stringify(segs));
  }
});

test('proxy rejects non-admin roots', () => {
  assert.equal(resolveProxyUrl(BASE, ['payments', 'x']), null);
  assert.equal(resolveProxyUrl(BASE, ['admin']), null);
  assert.equal(resolveProxyUrl(BASE, ['administrator', 'x']), null);
  assert.equal(resolveProxyUrl(BASE, []), null);
});

test('proxy query string cannot change the path', () => {
  const url = resolveProxyUrl(BASE, ['admin', 'audit'], '?q=/../../x#frag');
  assert.ok(url);
  assert.equal(url.pathname, '/api/v1/admin/audit');
});

test('next: keeps same-origin paths', () => {
  assert.equal(safeNextPath('/sessions'), '/sessions');
  assert.equal(safeNextPath('/organizations/abc?tab=staff'), '/organizations/abc?tab=staff');
});

test('next: falls back to / for anything else', () => {
  for (const bad of [
    null,
    undefined,
    '',
    '//evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '\\\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    'sessions',
    '/\tevil',
    '/%0d%0a',
  ]) {
    const out = safeNextPath(bad as string);
    assert.ok(out.startsWith('/') && !out.startsWith('//'), String(bad));
    if (bad !== '/%0d%0a') assert.equal(out, '/', String(bad));
  }
});

test('origin check', () => {
  assert.equal(isSameOriginRequest({ origin: 'https://admin.example', host: 'admin.example' }), true);
  assert.equal(isSameOriginRequest({ origin: 'http://localhost:3002', host: 'localhost:3002' }), true);
  assert.equal(
    isSameOriginRequest({ referer: 'https://admin.example/staff', host: 'admin.example' }),
    true
  );
  assert.equal(isSameOriginRequest({ origin: 'https://evil.example', host: 'admin.example' }), false);
  assert.equal(isSameOriginRequest({ origin: 'null', host: 'admin.example' }), false);
  assert.equal(isSameOriginRequest({ host: 'admin.example' }), false);
  assert.equal(isSameOriginRequest({ origin: 'https://admin.example' }), false);
});

test('single flight shares one in-flight call per key', async () => {
  const run = createSingleFlight<number>(1000);
  let calls = 0;
  const fn = () => new Promise<number>((r) => setTimeout(() => r(++calls), 10));
  const results = await Promise.all([run('rt1', fn), run('rt1', fn), run('rt1', fn)]);
  assert.deepEqual(results, [1, 1, 1]);
  assert.equal(await run('rt1', fn), 1, 'settled result reused within ttl');
  assert.equal(await run('rt2', fn), 2, 'other key runs separately');
});

test('single flight does not cache failures', async () => {
  const run = createSingleFlight<number>(1000);
  await assert.rejects(run('k', () => Promise.reject(new Error('down'))));
  assert.equal(await run('k', () => Promise.resolve(7)), 7);
});

test('session expired: only the proxy-marked 401 signs the person out', () => {
  const res = (status: number, headers: Record<string, string> = {}) => ({
    status,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });
  // Refresh failed: the proxy marks it.
  assert.equal(isSessionExpired(res(401, { [SESSION_EXPIRED_HEADER]: '1' })), true);
  // Backend 401 passed through after a good refresh, e.g. change-password with
  // a wrong current password: an error for the form, not a redirect to sign-in.
  assert.equal(isSessionExpired(res(401)), false);
  assert.equal(isSessionExpired(res(403, { [SESSION_EXPIRED_HEADER]: '1' })), false);
  assert.equal(isSessionExpired(res(200)), false);
});

test('PASSWORD_CHANGE_REQUIRED sends the person to change their password', () => {
  const body = { success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: 'x' };
  assert.equal(passwordChangeRedirect(403, body, '/'), PASSWORD_CHANGE_PATH);
  assert.equal(passwordChangeRedirect(403, body, '/sessions'), '/account?first=1');
  // Already there: no reload loop from the page's own side calls.
  assert.equal(passwordChangeRedirect(403, body, '/account'), null);
  // Any other 403, or the code on another status, is a normal error.
  assert.equal(passwordChangeRedirect(403, { code: 'FORBIDDEN' }, '/'), null);
  assert.equal(passwordChangeRedirect(403, {}, '/'), null);
  assert.equal(passwordChangeRedirect(401, body, '/'), null);
  // A wrong current password (400) stays on the form as an error.
  assert.equal(
    passwordChangeRedirect(400, { code: 'INVALID_CURRENT_PASSWORD' }, '/account'),
    null
  );
});

// ---------------------------------------------------------------------------
// Shop route allowlist
// ---------------------------------------------------------------------------

const route = (method: string, path: string) => isShopRoute(method, path.split('/'));

test('shop allowlist: everything the dashboard itself uses is reachable', () => {
  for (const [m, p] of [
    ['GET', 'admin/shop'],
    ['GET', 'admin/kiosks'],
    ['PATCH', 'admin/kiosks/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['GET', 'admin/printers'],
    ['POST', 'admin/printers/RPI_M001_01/revoke'],
    ['GET', 'admin/attention'],
    ['GET', 'admin/reports/summary'],
    ['GET', 'admin/reports/series'],
    ['GET', 'admin/reports/sessions'],
    ['GET', 'admin/reports/sessions/export'],
    ['GET', 'admin/pricing'],
    ['GET', 'admin/pricing/lists'],
    ['GET', 'admin/users'],
    ['PATCH', 'admin/users/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['DELETE', 'admin/users/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['POST', 'admin/users/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/reset-password'],
    ['GET', 'admin/audit'],
    ['GET', 'admin/audit/actions'],
    ['POST', 'admin/auth/change-password'],
  ] as const) {
    assert.equal(route(m, p), true, `${m} ${p}`);
  }
});

test('shop allowlist: platform routes are not reachable, whatever the method', () => {
  for (const [m, p] of [
    // organizations: the whole partner directory
    ['GET', 'admin/organizations'],
    ['POST', 'admin/organizations'],
    ['GET', 'admin/organizations/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['PATCH', 'admin/organizations/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['DELETE', 'admin/organizations/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10'],
    ['POST', 'admin/organizations/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/status'],
    ['POST', 'admin/organizations/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/kiosks'],
    // cross-shop reporting and platform health
    ['GET', 'admin/reports/organizations'],
    ['GET', 'admin/queue/status'],
    ['GET', 'admin/leads'],
    // minting and rotating printer secrets, creating QR points and accounts
    ['POST', 'admin/printers/enroll'],
    ['POST', 'admin/printers/RPI_M001_01/rotate-key'],
    ['PATCH', 'admin/printers/RPI_M001_01'],
    ['POST', 'admin/kiosks'],
    ['POST', 'admin/users'],
    // pricing and money
    ['POST', 'admin/pricing/lists'],
    ['POST', 'admin/print-jobs/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/refund'],
    // permissions: a shop cannot reshape its own staff's access from here
    ['PUT', 'admin/users/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/permissions'],
    ['GET', 'admin/users/3f1c9a52-7d0e-4b0a-9c1f-2f6f7a1d9e10/permissions'],
  ] as const) {
    assert.equal(route(m, p), false, `${m} ${p}`);
  }
});

test('shop allowlist: right path, wrong method is refused', () => {
  assert.equal(route('DELETE', 'admin/kiosks/abc'), false);
  assert.equal(route('POST', 'admin/reports/summary'), false);
  assert.equal(route('PUT', 'admin/users/abc'), false);
  assert.equal(route('GET', 'admin/printers/abc/revoke'), false);
  assert.equal(route('DELETE', 'admin/shop'), false);
});

test('shop allowlist: no wildcard leaks through :id', () => {
  // :id is a single id-shaped segment, not a path prefix.
  assert.equal(route('PATCH', 'admin/users/abc/permissions'), false);
  assert.equal(route('PATCH', 'admin/kiosks/abc/anything'), false);
  assert.equal(route('POST', 'admin/printers/abc/revoke/extra'), false);
  assert.equal(route('PATCH', 'admin/users/'), false);
  assert.equal(route('PATCH', 'admin/users/a b'), false);
  assert.equal(route('PATCH', 'admin/users/abc;rm'), false);
  assert.equal(route('PATCH', `admin/users/${'a'.repeat(65)}`), false);
});

test('shop allowlist: case and prefix tricks do not match', () => {
  assert.equal(route('GET', 'admin/Shop'), false);
  assert.equal(route('GET', 'Admin/shop'), false);
  assert.equal(route('GET', 'admin/shop/'), false);
  assert.equal(route('GET', 'admin/shops'), false);
  assert.equal(route('GET', 'shop'), false);
  assert.equal(isShopRoute('GET', []), false);
  assert.equal(isShopRoute('GET', ['admin']), false);
});

test('shop allowlist: method is case-insensitive, as HTTP clients vary', () => {
  assert.equal(isShopRoute('get', ['admin', 'shop']), true);
  assert.equal(isShopRoute('delete', ['admin', 'shop']), false);
});

// ---------------------------------------------------------------------------
// Tenant selectors
// ---------------------------------------------------------------------------

test('strips every spelling of an organization selector from the query', () => {
  assert.equal(stripTenantParams('?organizationId=abc'), '');
  assert.equal(stripTenantParams('?period=month&organizationId=abc'), '?period=month');
  assert.equal(stripTenantParams('?OrganizationID=abc&limit=5'), '?limit=5');
  assert.equal(stripTenantParams('?organization_id=abc'), '');
  assert.equal(stripTenantParams('?orgId=abc&tenantId=def&period=day'), '?period=day');
  // repeated, to try the "last one wins" / "first one wins" ambiguity
  assert.equal(stripTenantParams('?organizationId=a&organizationId=b'), '');
});

test('leaves ordinary query parameters alone', () => {
  assert.equal(stripTenantParams(''), '');
  assert.equal(stripTenantParams('?period=month&limit=25&offset=50'), '?period=month&limit=25&offset=50');
  assert.equal(stripTenantParams('?kioskId=3f1c9a52'), '?kioskId=3f1c9a52');
});

test('a request body that names an organization is detected', () => {
  assert.equal(bodyNamesTenant(JSON.stringify({ organizationId: 'abc' })), true);
  assert.equal(bodyNamesTenant(JSON.stringify({ name: 'x', OrganizationId: 'abc' })), true);
  assert.equal(bodyNamesTenant(JSON.stringify({ organization_id: 'abc' })), true);
  assert.equal(bodyNamesTenant(JSON.stringify({ isActive: false })), false);
  assert.equal(bodyNamesTenant(JSON.stringify({ currentPassword: 'a', newPassword: 'b' })), false);
  assert.equal(bodyNamesTenant(''), false);
  assert.equal(bodyNamesTenant(undefined), false);
  assert.equal(bodyNamesTenant('not json'), false);
  assert.equal(bodyNamesTenant('[1,2]'), false);
});
