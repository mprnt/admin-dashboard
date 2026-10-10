# MPrnt Admin

The shop dashboard for the MPrnt print platform: one shop looking at its own
business. Next.js 14 (App Router), TypeScript, Tailwind. Talks to the
`mprnt-backend` admin API.

**This is for shop accounts only.** A shop sees its own sessions, printers,
revenue, staff, rates and audit trail, and when it joined and what it has earned
since. There is no organization directory, no cross-shop view and no shop
switcher, and a platform (super admin) account is refused at sign-in. The
platform console is a separate site.

What a shop cannot do from here, because MPrnt does it for them: add a QR
point, enroll or re-key a printer, create staff accounts, set pricing, issue
refunds. Each of those points the shop at MPrnt (email and phone, pre-filled).

---

## Run it

```bash
npm install
cp .env.example .env.local     # point MPRNT_API_URL at your backend
npm run dev                    # http://localhost:3002
```

The backend must be running and migrated, with at least one shop and a shop
account to sign in as (shop accounts are created by the platform; this site
cannot create them).

| Variable | Default | Purpose |
|---|---|---|
| `MPRNT_API_URL` | `http://localhost:3000/api/v1` | Backend base URL, no trailing slash |

---

## How auth works

**No token is ever readable by page JavaScript.** Both the access and refresh
tokens live in `httpOnly` cookies set by Next.js route handlers. The browser
calls `/api/proxy/admin/*`, and the proxy attaches the `Authorization` header
server-side.

```
browser ──▶ /api/proxy/admin/*  ──▶  backend /api/v1/admin/*
            (adds Bearer token,
             refreshes on 401)
```

This matters because the dashboard shows revenue and manages staff accounts. In
the usual `localStorage` pattern, one XSS bug hands an attacker a 7-day
credential. Here there is nothing in JS to steal - verified in the browser:
`document.cookie` exposes only a non-secret display profile, and storage holds
no JWT.

Three consequences worth knowing:

- **401s are invisible.** The proxy refreshes once and replays the request, so a
  15-minute access token never interrupts anyone mid-task.
- **The proxy is a narrow door.** It forwards only the exact method + path pairs
  this dashboard uses (`isShopRoute` in `lib/security.ts`), strips any
  organization selector from the query, and refuses a body that names one.
  Platform routes answer `404`, exactly like an unknown route.
- **`mprnt_profile` is deliberately readable.** It drives which nav and buttons
  render. It is editable by anyone with devtools, so the backend re-checks every
  permission on every request - hiding a button is courtesy, not security.

`middleware.ts` redirects unauthenticated visitors to `/login`. That is a
convenience, not a boundary.

---

## Theme

Colour tokens are CSS custom properties, mirroring `mprnt-qr/app/globals.css`
so both apps share one visual language. Change brand colours in **both** files.

Dark mode follows the OS by default and can be forced light or dark. A tiny
inline script in `<head>` applies the stored choice before first paint,
otherwise dark-mode users get a white flash on every navigation.

### `accent` vs `primary`

The brand green (`#226d45`) measures **2.86:1** against the dark surface - fine
as a button fill, illegible as text. So:

- `bg-primary` - solid fills, always the brand green
- `text-accent` - anything that must be *read*: links, active nav, emphasis

`--color-accent` resolves to the brand green in light mode and a lighter green
in dark mode. Use `text-accent`, not `text-primary`.

---

## Responsive

Navigation adapts rather than shrinking:

| Width | Layout |
|---|---|
| `lg`+ (1024px) | Persistent sidebar |
| below `lg` | Bottom tab bar, 4 destinations + "More" sheet |
| below `md` (768px) | Tables become cards |
| below `xs` (400px) | Stat grids go single-column |

Bottom navigation is deliberate: on a phone held one-handed, the top of the
screen is the hardest place to reach. The tab bar respects
`env(safe-area-inset-bottom)` so it never sits under the iOS home indicator.

The session list is a real `<table>` on desktop and cards on mobile. A
seven-column table at 375px is unreadable however much you scroll it.

---

## Accessibility

Checked in-browser, both themes:

- **Contrast**: every text/background pair clears WCAG AA (4.5:1). Verified -
  the kiosk flow's bright success green and amber measured 2.22:1 and 2.09:1 on
  an off-white surface, so this app uses darker variants for text.
- **Zoom is not disabled.** Unlike the kiosk flow, this shows dense figures, and
  pinch-zoom is how people with low vision read them.
- **Keyboard**: skip link is the first tab stop; one consistent `:focus-visible`
  ring; dialogs take focus, trap scroll and close on Escape.
- **Landmarks**: one `<h1>` per page, no heading-level skips, named `nav` and
  `main`, `aria-current="page"` on active links.
- **Status is never colour alone** - every pill carries a label.
- **Charts have a table.** The SVG is `aria-hidden`; the same data is rendered
  as a visually hidden `<table>`.
- **Touch targets** are ≥44px (38px for compact buttons).
- **`prefers-reduced-motion`** disables animation.
- **Async results are announced** via `role="status"` toasts.

---

## Structure

```
app/
  login/                  sign-in
  (dashboard)/            authenticated shell
    page.tsx              overview: KPIs, revenue chart, alerts
    sessions/             job list, filters, CSV export
    printers/             printer health + QR points
    attention/            paid but unprinted - the page that costs money
    staff/                admin accounts, one-time passwords
    shop/                 when you joined, lifetime revenue, your setup
    pricing/              rates in force + history
    audit/                administrative changes
    account/              own profile, password change
  api/
    auth/login|logout     sets/clears httpOnly cookies
    proxy/[...path]       BFF: attaches token, refreshes on 401
components/
  Shell, Icon, ThemeToggle, ThemeScript, PeriodFilter, RevenueChart, ui.tsx
lib/
  api.ts       client calls + response types
  session.ts   server-only cookie/token handling
  profile.ts   shared profile shape + parsing
  useApi.ts    fetch hook with cancellation
  format.ts    currency, dates, durations (en-IN)
```

---

## Notes for whoever picks this up

**Data fetching is a plain hook**, not SWR or React Query. The needs here are a
request, a loading state and a retry. Swap it in if list invalidation gets
complicated - don't add it before that.

**The chart is hand-rolled SVG.** One bar series did not justify a charting
dependency, and inline SVG inherits the theme tokens directly, so dark mode
needs no separate config.

**Dates from the API are already in the shop's timezone.** `format.ts` parses
bare `YYYY-MM-DD` as local, not UTC, so the browser's own offset doesn't shift
them. The backend hit three separate bugs in this area; don't reintroduce them
by passing these through `new Date()` casually.

**Isolation lives in the backend.** A shop's scope comes from its token, never
from the request: every list is filtered by the token's organization, and a
request that names another one is a `404`. This site adds the narrow proxy on
top so a mistake in either place is not also a route to a platform feature.
`scripts/verify-isolation.mjs` signs in as real shop accounts and attacks one
shop from another - through this site and straight at the backend - then
checks nothing changed. Run it against local or staging after any change to
auth, the proxy or a backend route:

```bash
ISO_ACCOUNTS=./accounts.json node scripts/verify-isolation.mjs   # see the header for the file
```

**Not built yet**: MFA. Refunds are issued by the platform, not by shop staff.
