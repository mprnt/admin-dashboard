'use client';

import React from 'react';
import { api, type DetailsSource, type ShopProfile } from '@/lib/api';
import { useCan } from '@/lib/useProfile';
import { dateTime } from '@/lib/format';
import { Button, Card, CardHeader, Field, inputClass } from '@/components/ui';

const NOT_ADDED = 'Not added yet';

/**
 * Where the shop's contact, bank and UPI details are kept, and who can change them. The
 * owner edits these; a manager or viewer reads them. The platform can also set them, and
 * the source of each is shown, so the shop can see what MPRNT entered and what it did.
 */
export function ShopDetailsCard({
  data,
  loading,
  onSaved,
}: {
  data: ShopProfile | null | undefined;
  loading: boolean;
  onSaved: () => void;
}) {
  const canEdit = useCan('shop:profile:write');
  const [editing, setEditing] = React.useState(false);

  if (loading || !data) {
    return (
      <Card>
        <CardHeader title="Contact and bank details" subtitle="Where MPRNT reaches you, and where your takings are paid" />
        <p className="px-4 pb-4 sm:px-5 sm:pb-5 text-sm text-text-muted">Loading…</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Contact and bank details"
        subtitle="Where MPRNT reaches you, and where your takings are paid"
        action={
          canEdit && !editing ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <ShopDetailsForm data={data} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} />
      ) : (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-5 text-sm">
          <Block title="Contact" by={data.contactUpdatedBy} at={data.contactUpdatedAt}>
            <Row label="Email" value={data.contactEmail} />
            <Row label="Phone" value={data.contactPhone} />
          </Block>
          <Block title="Bank account and UPI" by={data.payout.updatedBy} at={data.payout.updatedAt}>
            <Row label="Account holder" value={data.payout.bankAccountHolder} />
            <Row label="Bank" value={data.payout.bankName} />
            <Row label="IFSC" value={data.payout.bankIfsc} />
            <Row label="Account number" value={data.payout.bankAccountLast4 ? `ending ${data.payout.bankAccountLast4}` : null} />
            <Row label="UPI ID" value={data.payout.upiId} />
          </Block>
          <Row label="Timezone" value={data.timezone} />
          {!canEdit && (
            <p className="text-xs text-text-muted">
              Only the owner of the shop can change these details. Ask the owner, or contact MPRNT.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Block({
  title,
  by,
  at,
  children,
}: {
  title: string;
  by: DetailsSource | null;
  at: string | null;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <Source by={by} at={at} />
      </div>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

/** Who set a detail: the shop, or MPRNT on its behalf. */
function Source({ by, at }: { by: DetailsSource | null; at: string | null }) {
  if (!by) return <span className="text-xs text-text-muted">{NOT_ADDED}</span>;
  return (
    <span className="text-xs text-text-muted">
      {by === 'shop' ? 'Added by you' : 'Added by MPRNT'}
      {at ? ` · ${dateTime(at)}` : ''}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      {value ? (
        <dd className="text-right text-text break-all">{value}</dd>
      ) : (
        <dd className="text-right text-text-muted">{NOT_ADDED}</dd>
      )}
    </div>
  );
}

/**
 * The owner's edit. Only what changed is sent, so a field the owner did not touch is not
 * rewritten. The account number is typed afresh: leaving it blank keeps the saved one.
 */
function ShopDetailsForm({
  data,
  onCancel,
  onSaved,
}: {
  data: ShopProfile;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const p = data.payout;
  const [email, setEmail] = React.useState(data.contactEmail ?? '');
  const [phone, setPhone] = React.useState(data.contactPhone ?? '');
  const [holder, setHolder] = React.useState(p.bankAccountHolder ?? '');
  const [bankName, setBankName] = React.useState(p.bankName ?? '');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [ifsc, setIfsc] = React.useState(p.bankIfsc ?? '');
  const [upi, setUpi] = React.useState(p.upiId ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const digits = accountNumber.replace(/\s+/g, '');
    if (digits && !/^[0-9]{6,18}$/.test(digits)) return setError('An account number is 6 to 18 digits.');
    if (ifsc.trim() && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) {
      return setError('An IFSC is 11 characters, for example HDFC0001234.');
    }
    if (upi.trim() && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(upi.trim())) {
      return setError('A UPI ID looks like name@bank, for example sharma@hdfc.');
    }

    // An empty value is sent as empty, which clears the saved detail.
    const contact: Record<string, string> = {};
    if (email.trim() !== (data.contactEmail ?? '')) contact.contactEmail = email.trim();
    if (phone.trim() !== (data.contactPhone ?? '')) contact.contactPhone = phone.trim();

    const bank: Record<string, string> = {};
    if (holder.trim() !== (p.bankAccountHolder ?? '')) bank.bankAccountHolder = holder.trim();
    if (bankName.trim() !== (p.bankName ?? '')) bank.bankName = bankName.trim();
    if (ifsc.trim().toUpperCase() !== (p.bankIfsc ?? '')) bank.bankIfsc = ifsc.trim().toUpperCase();
    if (upi.trim() !== (p.upiId ?? '')) bank.upiId = upi.trim();
    if (digits) bank.bankAccountNumber = digits;

    if (Object.keys(contact).length === 0 && Object.keys(bank).length === 0) return onCancel();

    setBusy(true);
    setError(null);
    try {
      if (Object.keys(contact).length > 0) await api.put('/shop/contact', contact);
      if (Object.keys(bank).length > 0) await api.put('/shop/payout', bank);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <form className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-5" onSubmit={save}>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-text">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="shop-email">
            <input id="shop-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Phone" htmlFor="shop-phone">
            <input id="shop-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-text">Bank account and UPI</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder" htmlFor="payout-holder">
            <input id="payout-holder" className={inputClass} value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Bank" htmlFor="payout-bank">
            <input id="payout-bank" className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={255} />
          </Field>
          <Field
            label="Account number"
            htmlFor="payout-number"
            hint={p.bankAccountLast4 ? `Leave blank to keep the saved account, ending ${p.bankAccountLast4}.` : 'Digits only.'}
          >
            <input
              id="payout-number"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              maxLength={24}
            />
          </Field>
          <Field label="IFSC" htmlFor="payout-ifsc" hint="11 characters, for example HDFC0001234">
            <input id="payout-ifsc" className={`${inputClass} uppercase`} value={ifsc} onChange={(e) => setIfsc(e.target.value)} maxLength={11} />
          </Field>
        </div>
        <Field label="UPI ID" htmlFor="payout-upi" hint="For example sharma@hdfc">
          <input id="payout-upi" className={inputClass} value={upi} onChange={(e) => setUpi(e.target.value)} maxLength={256} />
        </Field>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </Button>
      </div>
    </form>
  );
}
