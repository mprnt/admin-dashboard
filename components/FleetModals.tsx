'use client';

import React from 'react';
import { api, ApiError, type KioskRow } from '@/lib/api';
import { Button, Field, Modal, inputClass } from '@/components/ui';

/**
 * Editing a QR point: its name, where it is, and whether it is taking jobs.
 *
 * A shop can do these for its own QR points. Creating one, moving one between
 * shops, enrolling printers and handling their keys are platform tasks and are
 * not in this dashboard.
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
    <Modal open={Boolean(kiosk)} title={`Edit QR point ${kiosk?.kioskId ?? ''}`} onClose={onClose}>
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
              : 'Customers who scan this QR point are told it is unavailable, and cannot start a session.'
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
