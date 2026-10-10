#!/usr/bin/env node
/**
 * Tenant isolation check for the shop dashboard.
 *
 * Signs in as real shop accounts and, as each one, tries to read and change
 * another shop's data - through this site's proxy and directly against the
 * backend. Every attempt must be refused or return nothing of the victim's,
 * and the victim's state must be identical afterwards.
 *
 *   ISO_ACCOUNTS=./accounts.json node scripts/verify-isolation.mjs
 *
 * Environment:
 *   ADMIN_URL      the dashboard         (default http://localhost:3002)
 *   API_URL        the backend, with /api/v1  (default http://localhost:3000/api/v1)
 *   ISO_ACCOUNTS   path to a JSON file, see below
 *
 * accounts.json:
 *   {
 *     "accounts": {
 *       "platform":     { "email": "...", "password": "..." },   // super admin: ground truth only
 *       "shop1_owner":  { "email": "...", "password": "..." },
 *       "shop1_viewer": { "email": "...", "password": "..." },
 *       "shop2_owner":  { "email": "...", "password": "..." },
 *       "shop4_owner":  { "email": "...", "password": "..." }
 *     },
 *     "shops": { "shop1_owner": "Shop 1", "shop2_owner": "Shop 2", "shop4_owner": "Shop 4" }
 *   }
 *
 * The platform account is used only to establish what each shop owns and to
 * confirm nothing changed; it is never the one attacking.
 *
 * Run it against local or staging. It performs real writes (they are all
 * expected to be refused, and it checks that they were), so do not point it at
 * a database you care about with accounts you do not control.
 */
import fs from 'node:fs';

/**
 * The backend allows 100 requests a minute per IP, and this script makes a few
 * hundred. It paces itself under that rather than asking for the limit to be
 * raised, so it stays runnable against any environment as it is configured.
 * ISO_RATE_PER_MIN overrides the budget.
 */
const realFetch = globalThis.fetch;
const BUDGET = Number(process.env.ISO_RATE_PER_MIN || 60);
const stamps = [];
async function fetch(...args) {
  for (;;) {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
    if (stamps.length < BUDGET) break;
    await new Promise((r) => setTimeout(r, stamps[0] + 60_000 - now + 50));
  }
  stamps.push(Date.now());
  return realFetch(...args);
}

const ADMIN = (process.env.ADMIN_URL || 'http://localhost:3002').replace(/\/+$/, '');
const API = (process.env.API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const FILE = process.env.ISO_ACCOUNTS;

if (!FILE) {
  console.error('Set ISO_ACCOUNTS to the accounts JSON file (see the header of this script).');
  process.exit(2);
}

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const creds = cfg.accounts;
const shopOf = cfg.shops;

// --------------------------------------------------------------------------
// Tiny harness
// --------------------------------------------------------------------------
const results = [];
function check(group, name, ok, detail = '') {
  results.push({ group, name, ok: Boolean(ok), detail });
}
const json = async (res) => {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text), text };
  } catch {
    return { status: res.status, body: null, text };
  }
};

// --------------------------------------------------------------------------
// Sessions: one through the dashboard, one straight to the backend
// --------------------------------------------------------------------------
async function siteLogin(c) {
  const res = await fetch(`${ADMIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ADMIN },
    body: JSON.stringify({ email: c.email, password: c.password }),
    redirect: 'manual',
  });
  const cookies = res.headers.getSetCookie().map((x) => x.split(';')[0]);
  return { res: await json(res), cookie: cookies.join('; '), cookieCount: cookies.length };
}

function site(session) {
  return async (method, path, body, extraHeaders = {}) =>
    json(
      await fetch(`${ADMIN}/api/proxy/admin${path}`, {
        method,
        headers: {
          cookie: session.cookie,
          origin: ADMIN,
          'content-type': 'application/json',
          ...extraHeaders,
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      })
    );
}

async function apiLogin(c) {
  const r = await json(
    await fetch(`${API}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: c.email, password: c.password }),
    })
  );
  if (!r.body?.data?.accessToken) throw new Error(`backend login failed for ${c.email}: ${r.status}`);
  return r.body.data.accessToken;
}

function api(token) {
  return async (method, path, body) =>
    json(
      await fetch(`${API}/admin${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );
}

// --------------------------------------------------------------------------
// Ground truth, from the platform account
// --------------------------------------------------------------------------
const platform = api(await apiLogin(creds.platform));

const orgs = (await platform('GET', '/organizations')).body.data.organizations;
const orgByName = Object.fromEntries(orgs.map((o) => [o.name, o]));

async function inventory(orgId) {
  const q = `?organizationId=${orgId}`;
  const [kiosks, printers, users, sessions] = await Promise.all([
    platform('GET', `/kiosks${q}`),
    platform('GET', `/printers${q}`),
    platform('GET', `/users${q}`),
    platform('GET', `/reports/sessions${q}&period=year&limit=50`),
  ]);
  return {
    kiosks: kiosks.body.data.kiosks,
    printers: printers.body.data.printers,
    users: users.body.data.users,
    jobs: sessions.body.data.sessions,
  };
}

/** What would visibly change if an attack worked. Volatile fields excluded. */
function fingerprint(inv) {
  return JSON.stringify({
    kiosks: inv.kiosks.map((k) => [k.id, k.name, k.location, k.status, k.organizationId]).sort(),
    printers: inv.printers
      .map((p) => [p.printerId, p.name, p.status, p.enrollment.revokedAt, p.enrollment.keyPrefix, p.station.isStation])
      .sort(),
    users: inv.users.map((u) => [u.id, u.email, u.role, u.isActive, u.fullName]).sort(),
    jobs: inv.jobs.map((j) => [j.jobId, j.status, j.paymentStatus]).sort(),
  });
}

const world = {};
for (const [key, shopName] of Object.entries(shopOf)) {
  const org = orgByName[shopName];
  if (!org) throw new Error(`No organization named "${shopName}"`);
  world[key] = { name: shopName, orgId: org.id, inv: await inventory(org.id) };
}

// --------------------------------------------------------------------------
// The attack matrix
// --------------------------------------------------------------------------
async function attack(attackerKey, victimKey) {
  const A = world[attackerKey];
  const V = world[victimKey];
  const group = `${A.name} -> ${V.name}`;

  const session = await siteLogin(creds[attackerKey]);
  check(group, 'attacker can sign in to the dashboard', session.res.status === 200, `status ${session.res.status}`);
  const viaSite = site(session);
  const viaApi = api(await apiLogin(creds[attackerKey]));

  const vKiosk = V.inv.kiosks[0];
  const vPrinter = V.inv.printers[0];
  const vUser = V.inv.users.find((u) => u.role === 'owner') || V.inv.users[0];
  const vJob = V.inv.jobs[0];

  const ownKioskIds = new Set(A.inv.kiosks.map((k) => k.id));
  const ownPrinterIds = new Set(A.inv.printers.map((p) => p.printerId));
  const ownUserIds = new Set(A.inv.users.map((u) => u.id));
  const victimPrinterIds = new Set(V.inv.printers.map((p) => p.printerId));
  const victimKioskIds = new Set(V.inv.kiosks.map((k) => k.id));
  const victimUserIds = new Set(V.inv.users.map((u) => u.id));
  const victimJobIds = new Set(V.inv.jobs.map((j) => j.jobId));

  const before = fingerprint(await inventory(V.orgId));

  // ---- Reads through the dashboard -------------------------------------
  {
    const r = await viaSite('GET', '/printers');
    const ids = (r.body?.data?.printers ?? []).map((p) => p.printerId);
    check(group, 'GET printers lists only own printers',
      r.status === 200 && ids.length > 0 && ids.every((i) => ownPrinterIds.has(i)),
      `${ids.length} returned`);
  }
  {
    const r = await viaSite('GET', '/kiosks');
    const ids = (r.body?.data?.kiosks ?? []).map((k) => k.id);
    check(group, 'GET kiosks lists only own QR points',
      r.status === 200 && ids.length > 0 && ids.every((i) => ownKioskIds.has(i)), `${ids.length} returned`);
  }
  {
    const r = await viaSite('GET', '/users');
    const ids = (r.body?.data?.users ?? []).map((u) => u.id);
    check(group, 'GET users lists only own staff',
      r.status === 200 && ids.length > 0 && ids.every((i) => ownUserIds.has(i)), `${ids.length} returned`);
  }
  {
    const r = await viaSite('GET', '/attention');
    const ids = (r.body?.data?.jobs ?? []).map((j) => j.jobId);
    check(group, 'GET attention contains no victim jobs',
      r.status === 200 && !ids.some((i) => victimJobIds.has(i)), `${ids.length} returned`);
  }
  {
    const own = await viaSite('GET', '/reports/summary?period=year');
    const spoof = await viaSite('GET', `/reports/summary?period=year&organizationId=${V.orgId}`);
    check(group, 'summary: organizationId is dropped, answer is still own',
      spoof.status === 200 && JSON.stringify(spoof.body?.data?.summary) === JSON.stringify(own.body?.data?.summary),
      `own revenue ${own.body?.data?.summary?.revenue}, spoof ${spoof.body?.data?.summary?.revenue}`);
  }
  {
    const r = await viaSite('GET', `/reports/summary?period=year&kioskId=${vKiosk.id}`);
    check(group, "summary for victim's QR point shows nothing",
      r.status !== 200 || (r.body?.data?.summary?.totalJobs === 0 && r.body?.data?.summary?.revenue === 0),
      `status ${r.status}, jobs ${r.body?.data?.summary?.totalJobs}`);
  }
  {
    const r = await viaSite('GET', `/reports/summary?period=year&printerId=${vPrinter.printerId}`);
    check(group, "summary for victim's printer shows nothing",
      r.status !== 200 || (r.body?.data?.summary?.totalJobs === 0 && r.body?.data?.summary?.revenue === 0),
      `status ${r.status}, jobs ${r.body?.data?.summary?.totalJobs}`);
  }
  {
    const r = await viaSite('GET', `/reports/series?period=year&printerId=${vPrinter.printerId}`);
    const total = (r.body?.data?.series ?? []).reduce((a, p) => a + p.revenue, 0);
    check(group, "series for victim's printer shows nothing", r.status !== 200 || total === 0, `revenue ${total}`);
  }
  {
    const r = await viaSite('GET', `/reports/sessions?period=year&limit=200&organizationId=${V.orgId}`);
    const ids = (r.body?.data?.sessions ?? []).map((s) => s.jobId);
    check(group, 'sessions: organizationId is dropped, no victim jobs',
      r.status === 200 && !ids.some((i) => victimJobIds.has(i)), `${ids.length} returned`);
  }
  {
    const r = await viaSite('GET', `/reports/sessions/export?period=year&organizationId=${V.orgId}`);
    const leaked = [...victimJobIds].some((id) => r.text.includes(id));
    check(group, 'CSV export contains no victim jobs', r.status === 200 && !leaked, `${r.text.split('\n').length - 1} rows`);
  }
  {
    const r = await viaSite('GET', `/pricing?kioskId=${vKiosk.id}`);
    check(group, "pricing for victim's QR point is refused or not specific to it",
      r.status !== 200 || r.body?.data?.source !== 'kiosk', `status ${r.status}, source ${r.body?.data?.source}`);
  }
  {
    const r = await viaSite('GET', '/pricing/lists');
    const leaked = (r.body?.data?.priceLists ?? []).filter((p) => p.organizationId === V.orgId);
    check(group, "price list history has none of the victim's own rates",
      r.status === 200 && leaked.length === 0, `${leaked.length} victim entries`);
  }
  {
    const r = await viaSite('GET', '/audit?limit=200');
    const foreign = (r.body?.data?.entries ?? []).filter(
      (e) => e.organization && e.organization.id && e.organization.id !== A.orgId
    );
    check(group, 'audit log has only own shop entries', r.status === 200 && foreign.length === 0,
      `${(r.body?.data?.entries ?? []).length} entries, ${foreign.length} foreign`);
  }
  {
    const r = await viaSite('GET', '/shop');
    check(group, 'GET shop is own shop, and only own',
      r.status === 200 && r.body?.data?.name === A.name, `name ${r.body?.data?.name}`);
    const keys = Object.keys(r.body?.data ?? {}).sort().join(',');
    check(group, 'GET shop exposes no id, slug, model or notes',
      !/\b(id|slug|businessModel|notes|organizationId)\b/.test(keys), keys);
  }
  {
    const r = await viaSite('GET', `/shop?organizationId=${V.orgId}`);
    check(group, 'GET shop ignores an organizationId',
      r.status === 200 && r.body?.data?.name === A.name, `name ${r.body?.data?.name}`);
  }

  // ---- Writes through the dashboard (all must fail) --------------------
  {
    const r = await viaSite('PATCH', `/kiosks/${vKiosk.id}`, { name: 'pwned-by-iso-test' });
    check(group, "PATCH victim's QR point refused", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaSite('POST', `/printers/${vPrinter.printerId}/revoke`);
    check(group, "revoke victim's printer refused", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaSite('PATCH', `/users/${vUser.id}`, { isActive: false });
    check(group, "deactivate victim's staff refused", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaSite('DELETE', `/users/${vUser.id}`);
    check(group, "delete victim's staff refused", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaSite('POST', `/users/${vUser.id}/reset-password`);
    check(group, "reset victim's password refused", r.status === 404 || r.status === 403, `status ${r.status}`);
  }

  // ---- Platform routes through the dashboard (not reachable) -----------
  for (const [m, p, body] of [
    ['GET', '/organizations'],
    ['GET', `/organizations/${V.orgId}`],
    ['PATCH', `/organizations/${V.orgId}`, { name: 'pwned' }],
    ['DELETE', `/organizations/${V.orgId}`],
    ['POST', `/organizations/${V.orgId}/status`, { status: 'suspended' }],
    ['GET', '/reports/organizations'],
    ['GET', '/queue/status'],
    ['GET', '/leads'],
    ['POST', '/printers/enroll', { printerId: 'RPI_ISO_X', kioskId: vKiosk.id, name: 'x', capabilities: {} }],
    ['POST', `/printers/${vPrinter.printerId}/rotate-key`],
    ['PATCH', `/printers/${vPrinter.printerId}`, { name: 'x' }],
    ['POST', '/kiosks', { kioskCode: 'ISOX', name: 'x', location: 'x' }],
    ['POST', '/users', { email: 'iso@x.test', role: 'owner' }],
    ['POST', '/pricing/lists', { bwPerPage: 0.01, colorPerPage: 0.01 }],
    ['POST', `/print-jobs/${vJob?.jobId ?? 'x'}/refund`, { reason: 'x' }],
    ['PUT', `/users/${vUser.id}/permissions`, { permission: 'refunds:issue', effect: 'grant' }],
  ]) {
    const r = await viaSite(m, p, body);
    check(group, `dashboard cannot reach ${m} ${p.replace(V.orgId, ':org').replace(vUser.id, ':user').replace(vPrinter.printerId, ':printer').replace(vJob?.jobId ?? 'x', ':job')}`,
      r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaSite('PATCH', `/users/${[...ownUserIds][0]}`, { isActive: true, organizationId: V.orgId });
    check(group, 'a body that names an organization is refused outright', r.status === 400, `status ${r.status}`);
  }
  {
    const r = await viaSite('GET', '/%2e%2e/%2e%2e/health');
    check(group, 'path traversal out of /admin is not forwarded', r.status === 404, `status ${r.status}`);
  }

  // ---- The same attacks, straight at the backend (no dashboard) --------
  {
    const r = await viaApi('GET', `/reports/summary?period=year&organizationId=${V.orgId}`);
    check(group, 'backend: organizationId for another shop is rejected', r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('GET', `/printers?organizationId=${V.orgId}`);
    check(group, "backend: another shop's printers via organizationId rejected", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('GET', `/users?organizationId=${V.orgId}`);
    check(group, "backend: another shop's staff via organizationId rejected", r.status === 404 || r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('GET', '/organizations');
    check(group, 'backend: organization directory is platform-only', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('GET', `/organizations/${V.orgId}`);
    check(group, "backend: another shop's profile is platform-only", r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('PATCH', `/kiosks/${vKiosk.id}`, { name: 'pwned-by-iso-test' });
    check(group, "backend: PATCH another shop's QR point is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('POST', `/printers/${vPrinter.printerId}/revoke`);
    check(group, "backend: revoke another shop's printer is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('PATCH', `/users/${vUser.id}`, { isActive: false });
    check(group, "backend: PATCH another shop's staff is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('DELETE', `/users/${vUser.id}`);
    check(group, "backend: DELETE another shop's staff is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('POST', `/users/${vUser.id}/reset-password`);
    check(group, "backend: reset another shop's password is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('PUT', `/users/${vUser.id}/permissions`, { permission: 'export:data', effect: 'grant' });
    check(group, "backend: another shop's permissions are a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('POST', '/pricing/lists', { organizationId: V.orgId, bwPerPage: 0.01, colorPerPage: 0.01 });
    check(group, 'backend: publishing prices for another shop is refused', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await viaApi('POST', '/pricing/lists', { bwPerPage: 0.01, colorPerPage: 0.01 });
    check(group, 'backend: publishing platform-wide prices is refused', r.status === 403, `status ${r.status}`);
  }
  if (vJob) {
    const r = await viaApi('POST', `/print-jobs/${vJob.jobId}/refund`, { reason: 'iso test' });
    check(group, "backend: refunding another shop's job is a 404", r.status === 404, `status ${r.status}`);
  }
  {
    const r = await viaApi('GET', `/reports/sessions?period=year&limit=200&kioskId=${vKiosk.id}`);
    const rows = r.body?.data?.sessions ?? [];
    check(group, "backend: sessions for another shop's QR point are empty",
      r.status !== 200 || rows.length === 0, `status ${r.status}, ${rows.length} rows`);
  }
  {
    const r = await viaApi('GET', '/shop');
    check(group, 'backend: /shop returns the caller\'s own shop', r.status === 200 && r.body?.data?.name === A.name,
      `name ${r.body?.data?.name}`);
  }

  // ---- Victim state is identical afterwards ----------------------------
  const after = fingerprint(await inventory(V.orgId));
  check(group, "victim's QR points, printers, staff and jobs are unchanged", before === after,
    before === after ? 'identical' : 'CHANGED');

  // keep sets referenced so the intent is explicit in the report
  void victimPrinterIds; void victimKioskIds; void victimUserIds;
}

await attack('shop1_owner', 'shop2_owner');
await attack('shop2_owner', 'shop1_owner');
if (world.shop4_owner) await attack('shop4_owner', 'shop1_owner');

// --------------------------------------------------------------------------
// Account-level rules
// --------------------------------------------------------------------------
{
  const g = 'accounts';
  const p = await siteLogin(creds.platform);
  check(g, 'a platform account is refused at dashboard sign-in', p.res.status === 403, `status ${p.res.status}`);
  check(g, 'a refused platform sign-in sets no cookie', p.cookieCount === 0, `${p.cookieCount} cookies`);
  check(g, 'the refusal says why', p.res.body?.code === 'PLATFORM_ACCOUNT', String(p.res.body?.code));

  const anon = await json(await fetch(`${ADMIN}/api/proxy/admin/shop`, { headers: { origin: ADMIN } }));
  check(g, 'no session, no data', anon.status === 401, `status ${anon.status}`);

  const csrf = await siteLogin(creds.shop1_owner);
  const forged = await json(
    await fetch(`${ADMIN}/api/proxy/admin/users/${world.shop1_owner.inv.users[0].id}`, {
      method: 'PATCH',
      headers: { cookie: csrf.cookie, origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
  );
  check(g, 'a cross-site state-changing request is refused', forged.status === 403, `status ${forged.status}`);

  if (creds.shop1_viewer) {
    const v = await siteLogin(creds.shop1_viewer);
    const vs = site(v);
    const own = world.shop1_owner.inv;
    check(g, 'viewer cannot list staff', (await vs('GET', '/users')).status === 403);
    check(g, 'viewer cannot read the audit log', (await vs('GET', '/audit')).status === 403);
    check(g, 'viewer cannot edit a QR point',
      (await vs('PATCH', `/kiosks/${own.kiosks[0].id}`, { name: 'viewer-edit' })).status === 403);
    check(g, 'viewer cannot revoke a printer',
      (await vs('POST', `/printers/${own.printers[0].printerId}/revoke`)).status === 403);
    check(g, 'viewer cannot export sessions', (await vs('GET', '/reports/sessions/export?period=year')).status === 403);
    check(g, 'viewer can read own reports', (await vs('GET', '/reports/summary?period=year')).status === 200);
  }
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------
let failed = 0;
let group = '';
for (const r of results) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group}`);
  }
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
