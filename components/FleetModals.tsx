'use client';

import React from 'react';
import { api, ApiError, type KioskRow, type OrganizationRow } from '@/lib/api';
import { Button, Field, Modal, inputClass } from '@/components/ui';

/**
 * Dialogs for managing shops, kiosks and printers. Shared by the
 * organizations list, a shop's detail page and the printers page.
 */

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
    >
      {message}
    </div>
  );
}

function useSubmit(onDone: () => void) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setSaving(true);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return { error, setError, saving, run };
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

const TIMEZONES = [
  ['Asia/Kolkata', 'Asia/Kolkata (IST)'],
  ['Asia/Dubai', 'Asia/Dubai'],
  ['Asia/Singapore', 'Asia/Singapore'],
  ['Europe/London', 'Europe/London'],
  ['America/New_York', 'America/New_York'],
  ['UTC', 'UTC'],
];

export function CreateOrgModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('Asia/Kolkata');
  const [contactEmail, setContactEmail] = React.useState('');
  const { error, setError, saving, run } = useSubmit(onCreated);

  React.useEffect(() => {
    if (open) {
      setName('');
      setContactEmail('');
      setError(null);
    }
  }, [open, setError]);

  return (
    <Modal open={open} title="New organization" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            api.post('/organizations', { name, timezone, contactEmail: contactEmail || undefined })
          );
        }}
        className="space-y-4"
      >
        <FormError message={error} />
        <Field label="Shop name" htmlFor="org-name">
          <input
            id="org-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Sharma Xerox"
          />
        </Field>
        <Field
          label="Timezone"
          htmlFor="org-tz"
          hint="Daily, weekly and monthly reports are bucketed in this timezone."
        >
          <select
            id="org-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputClass}
          >
            {TIMEZONES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact email" htmlFor="org-email" hint="Optional">
          <input
            id="org-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} className="flex-1">
            Create
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AssignKioskModal({
  org,
  kiosks,
  onClose,
  onAssigned,
}: {
  org: { id: string; name: string } | null;
  kiosks: KioskRow[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [kioskId, setKioskId] = React.useState('');
  const { error, setError, saving, run } = useSubmit(onAssigned);

  React.useEffect(() => {
    setKioskId('');
    setError(null);
  }, [org, setError]);

  const candidates = kiosks.filter((k) => k.organizationId !== org?.id);

  return (
    <Modal open={Boolean(org)} title={`Move a kiosk to ${org?.name ?? ''}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.post(`/organizations/${org!.id}/kiosks`, { kioskId }));
        }}
        className="space-y-4"
      >
        <FormError message={error} />
        <Field
          label="Kiosk"
          htmlFor="assign-kiosk"
          hint="New jobs on this kiosk will belong to this shop. Revenue already earned stays with the shop that earned it."
        >
          <select
            id="assign-kiosk"
            required
            value={kioskId}
            onChange={(e) => setKioskId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a kiosk…</option>
            {candidates.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kioskId} — {k.name}
                {k.organizationName ? ` (currently ${k.organizationName})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={saving} disabled={!kioskId} className="flex-1">
            Move kiosk
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Kiosks
// ---------------------------------------------------------------------------

export function CreateKioskModal({
  open,
  organizations,
  defaultOrgId,
  onClose,
  onCreated,
}: {
  open: boolean;
  organizations: OrganizationRow[];
  defaultOrgId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kioskCode, setKioskCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [organizationId, setOrganizationId] = React.useState('');
  const [color, setColor] = React.useState(false);
  const [duplex, setDuplex] = React.useState(true);
  const { error, setError, saving, run } = useSubmit(onCreated);

  React.useEffect(() => {
    if (open) {
      setKioskCode('');
      setName('');
      setLocation('');
      setOrganizationId(defaultOrgId ?? organizations[0]?.id ?? '');
      setError(null);
    }
  }, [open, defaultOrgId, organizations, setError]);

  return (
    <Modal open={open} title="Add a kiosk" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            api.post('/kiosks', {
              kioskCode: kioskCode.toUpperCase(),
              name,
              location,
              organizationId,
              capabilities: { color, duplex, paperSizes: ['a4'] },
            })
          );
        }}
        className="space-y-4"
      >
        <FormError message={error} />
        <Field
          label="Kiosk code"
          htmlFor="k-code"
          hint="2–10 letters or digits. This is what the QR code points at — it cannot be changed later."
        >
          <input
            id="k-code"
            required
            value={kioskCode}
            onChange={(e) => setKioskCode(e.target.value.toUpperCase())}
            className={`${inputClass} uppercase font-mono`}
            placeholder="M002"
            maxLength={10}
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Name" htmlFor="k-name" hint="What staff will call it, e.g. “Front counter”.">
          <input
            id="k-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Location" htmlFor="k-loc">
          <input
            id="k-loc"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="Library, ground floor"
          />
        </Field>
        <Field label="Shop" htmlFor="k-org">
          <select
            id="k-org"
            required
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className={inputClass}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-text mb-1">Offers</legend>
          <label className="flex items-center gap-3 min-h-[36px]">
            <input
              type="checkbox"
              checked={color}
              onChange={(e) => setColor(e.target.checked)}
              className="w-5 h-5 accent-[rgb(var(--color-primary))]"
            />
            <span className="text-sm text-text">Colour printing</span>
          </label>
          <label className="flex items-center gap-3 min-h-[36px]">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="w-5 h-5 accent-[rgb(var(--color-primary))]"
            />
            <span className="text-sm text-text">Double-sided printing</span>
          </label>
        </fieldset>
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} disabled={!organizationId} className="flex-1">
            Add kiosk
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function EditKioskModal({
  kiosk,
  onClose,
  onSaved,
}: {
  kiosk: KioskRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const { error, setError, saving, run } = useSubmit(onSaved);

  React.useEffect(() => {
    if (kiosk) {
      setName(kiosk.name);
      setLocation(kiosk.location);
      setStatus(kiosk.status === 'offline' ? 'active' : kiosk.status);
      setError(null);
    }
  }, [kiosk, setError]);

  return (
    <Modal open={Boolean(kiosk)} title={`Edit kiosk ${kiosk?.kioskId ?? ''}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.patch(`/kiosks/${kiosk!.id}`, { name, location, status }));
        }}
        className="space-y-4"
      >
        <FormError message={error} />
        <Field label="Name" htmlFor="ek-name">
          <input
            id="ek-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Location" htmlFor="ek-loc">
          <input
            id="ek-loc"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label="Service status"
          htmlFor="ek-status"
          hint={
            status === 'active'
              ? 'Customers can scan and print.'
              : 'Customers who scan this kiosk are told it is unavailable, and cannot start a session.'
          }
        >
          <select
            id="ek-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="active">In service</option>
            <option value="maintenance">Under maintenance</option>
            <option value="inactive">Out of service</option>
          </select>
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} className="flex-1">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Printers
// ---------------------------------------------------------------------------

export function EnrollPrinterModal({
  open,
  kiosks,
  defaultKioskId,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  kiosks: KioskRow[];
  defaultKioskId?: string;
  onClose: () => void;
  onEnrolled: (printerId: string, apiKey: string) => void;
}) {
  const [kioskId, setKioskId] = React.useState('');
  const [printerId, setPrinterId] = React.useState('');
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState(false);
  const [duplex, setDuplex] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Suggest an id from the kiosk code, following the RPI_<code>_<n> convention.
  const kiosk = kiosks.find((k) => k.id === kioskId);
  React.useEffect(() => {
    if (open) {
      const initial = defaultKioskId ?? kiosks[0]?.id ?? '';
      setKioskId(initial);
      setName('');
      setError(null);
    }
  }, [open, defaultKioskId, kiosks]);
  React.useEffect(() => {
    if (kiosk) setPrinterId(`RPI_${kiosk.kioskId}_0${kiosk.printersTotal + 1}`);
  }, [kiosk]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api.post<{ printerId: string; apiKey: string }>('/printers/enroll', {
        printerId,
        kioskId,
        name: name || `${kiosk?.name ?? 'Kiosk'} printer`,
        capabilities: {
          supportsColor: color,
          supportsDoubleSided: duplex,
          maxCopies: 50,
          supportedPaperSizes: ['a4'],
        },
      });
      onEnrolled(res.printerId, res.apiKey);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not enroll the printer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Enroll a printer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormError message={error} />
        <Field label="Kiosk" htmlFor="ep-kiosk">
          <select
            id="ep-kiosk"
            required
            value={kioskId}
            onChange={(e) => setKioskId(e.target.value)}
            className={inputClass}
          >
            {kiosks.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kioskId} — {k.name}
                {k.organizationName ? ` (${k.organizationName})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Printer ID"
          htmlFor="ep-id"
          hint="The Pi sends this as X-Printer-Id. Letters, digits, underscores, hyphens."
        >
          <input
            id="ep-id"
            required
            value={printerId}
            onChange={(e) => setPrinterId(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Name" htmlFor="ep-name" hint="Optional">
          <input
            id="ep-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Counter printer"
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-text mb-1">
            What this printer can actually do
          </legend>
          <p className="text-xs text-text-muted -mt-1 mb-1">
            Jobs are matched on this. Claim colour on a mono printer and colour jobs will be sent to
            it and fail.
          </p>
          <label className="flex items-center gap-3 min-h-[36px]">
            <input
              type="checkbox"
              checked={color}
              onChange={(e) => setColor(e.target.checked)}
              className="w-5 h-5 accent-[rgb(var(--color-primary))]"
            />
            <span className="text-sm text-text">Colour</span>
          </label>
          <label className="flex items-center gap-3 min-h-[36px]">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="w-5 h-5 accent-[rgb(var(--color-primary))]"
            />
            <span className="text-sm text-text">Double-sided</span>
          </label>
        </fieldset>
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={saving} disabled={!kioskId} className="flex-1">
            Enroll and show key
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Shows a printer key exactly once. The backend stores only a digest, so this
 * is the only moment it exists in readable form — the copy says so plainly.
 */
export function PrinterKeyModal({
  secret,
  onClose,
}: {
  secret: { printerId: string; apiKey: string; rotated?: boolean } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => setCopied(false), [secret]);

  return (
    <Modal
      open={Boolean(secret)}
      title={secret?.rotated ? 'New printer key' : 'Printer enrolled'}
      onClose={onClose}
    >
      {secret && (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-text">
            <strong className="font-semibold">Copy this now.</strong> The key is not stored anywhere
            and cannot be shown again — only replaced.
            {secret.rotated && ' The previous key has already stopped working.'}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                X-Printer-Id
              </p>
              <p className="font-mono text-sm text-text break-all">{secret.printerId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                X-Printer-Key
              </p>
              <p className="font-mono text-sm text-text break-all select-all">{secret.apiKey}</p>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            On the Pi, store it in <span className="font-mono">/etc/mprnt/printer.env</span> with
            mode 0640. Send it to whoever sets up the Pi through a private channel — not a group
            chat.
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                await navigator.clipboard?.writeText(
                  `X-Printer-Id: ${secret.printerId}\nX-Printer-Key: ${secret.apiKey}`
                );
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy both'}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
