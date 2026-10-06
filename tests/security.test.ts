import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSingleFlight,
  isSameOriginRequest,
  isSessionExpired,
  PASSWORD_CHANGE_PATH,
  passwordChangeRedirect,
  resolveProxyUrl,
  SESSION_EXPIRED_HEADER,
  safeNextPath,
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
