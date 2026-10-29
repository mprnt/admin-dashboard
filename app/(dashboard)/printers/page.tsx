'use client';

import React from 'react';
import { useApi } from '@/lib/useApi';
import { useProfile } from '@/lib/useProfile';
import { api, ApiError, type KioskRow, type PrinterRow } from '@/lib/api';
import { plural, printerState, qrState, type Tone } from '@/lib/plain';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  Toast,
} from '@/components/ui';
import { Callout, StateBadge, TechnicalDetails } from '@/components/Plain';
import { Icon } from '@/components/Icon';
import { ContactLine } from '@/components/ContactSupport';
import { EditKioskModal } from '@/components/FleetModals';
import { PaperTank } from '@/components/viz/PaperTank';

const TONE_RANK: Record<Tone, number> = { bad: 0, warn: 1, info: 2, neutral: 3, good: 4 };
const LOW_PAPER = 20;

/**
 * Your QR points, and the printers behind each one.
 *
 * A QR point is the place a customer scans to print. A job goes to whichever
 * printer at that point is free, so two printers at one counter cover for each
 * other. Problems are listed first, with the next step written out.
 *
 * Adding a QR point or a printer, and changing a printer's key, are done by
 * MPRNT, because they create secrets. The page says so, rather than leaving the
 * owner looking for a button that is not there.
 */
export default function PrintersPage() {
  const profile = useProfile();
  const canManage = Boolean(profile?.permissions.includes('printers:manage'));

  const printers = useApi<{ count: number; printers: PrinterRow[] }>('/printers');
  const kiosks = useApi<{ count: number; kiosks: KioskRow[] }>('/kiosks');

  const [editKiosk, setEditKiosk] = React.useState<KioskRow | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const reloadAll = () => {
    printers.reload();
    kiosks.reload();
  };

  async function turnOff(p: PrinterRow) {
    if (
      !confirm(
        `Turn off ${p.station.label}? It will stop printing straight away. Contact MPRNT to switch it back on.`
      )
    ) {
      return;
    }
    try {
      await api.post(`/printers/${encodeURIComponent(p.printerId)}/revoke`);
      setToast({ message: `${p.station.label} is turned off`, tone: 'success' });
      reloadAll();
    } catch (e) {
      setToast({ message: e instanceof ApiError ? e.message : 'Could not turn it off', tone: 'error' });
    }
  }

  const printerList = printers.data?.printers ?? [];
  const kioskList = kiosks.data?.kiosks ?? [];
  const loading = printers.loading || kiosks.loading;
  const failed = printers.error || kiosks.error;

  // One group per QR point, with the ones that need attention first.
  const groups = kioskList
    .map((kiosk) => ({
      kiosk,
      printers: printerList.filter((p) => p.kiosk.id === kiosk.id),
    }))
    .sort((a, b) => TONE_RANK[qrState(a.kiosk).tone] - TONE_RANK[qrState(b.kiosk).tone]);

  const notConnected = printerList.filter((p) => printerState(p).label === 'Not connected').length;
  const turnedOff = printerList.filter((p) => p.status === 'revoked').length;
  const noPrinter = kioskList.filter((k) => k.printersTotal === 0).length;
  const paperLow = printerList.filter(
    (p) => p.status !== 'revoked' && p.paperLevel !== null && p.paperLevel < LOW_PAPER
  ).length;
  const problems = [
    notConnected > 0 && `${plural(notConnected, 'printer')} not connected. Check the power and internet on it.`,
    turnedOff > 0 && `${plural(turnedOff, 'printer')} turned off. Contact MPRNT to switch it back on.`,
    noPrinter > 0 && `${plural(noPrinter, 'QR point')} has no printer, so nothing will print there.`,
    paperLow > 0 && `Paper is low on ${plural(paperLow, 'printer')}. Refill the tray.`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printers & QR points"
        subtitle="Where customers print, and whether each printer is ready."
      />

      <p className="text-sm text-text-muted">
        A QR point is the spot where a customer scans to print. Each one can have more than one printer,
        and a job goes to whichever printer is free.
      </p>

      {!loading && !failed && (
        problems.length > 0 ? (
          <Callout tone={notConnected + turnedOff + noPrinter > 0 ? 'bad' : 'warn'} title="Some printers need you">
            <ul className="list-disc space-y-1 pl-5">
              {problems.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <ContactLine className="mt-2" subject="Printer problem">
              If a printer stays off after you check it, contact MPRNT:
            </ContactLine>
          </Callout>
        ) : (
          <Callout tone="good" title="Everything is working">
            All {plural(printerList.length, 'printer')} ready for customers.
          </Callout>
        )
      )}

      {failed ? (
        <Card>
          <ErrorState message={failed} onRetry={reloadAll} />
        </Card>
      ) : loading ? (
        <Card>
          <SkeletonRows rows={3} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No QR points yet"
            message="MPRNT sets up your QR points and printers."
            icon={<Icon name="building" className="h-6 w-6" />}
            action={<ContactLine subject="Set up a QR point for my shop">Contact MPRNT to add one:</ContactLine>}
          />
        </Card>
      ) : (
        groups.map(({ kiosk, printers: inside }) => (
          <QrPointCard
            key={kiosk.id}
            kiosk={kiosk}
            printers={inside}
            canManage={canManage}
            onEdit={() => setEditKiosk(kiosk)}
            onTurnOff={turnOff}
          />
        ))
      )}

      <p className="text-xs text-text-muted">
        Need another QR point or printer, or one replaced? Contact MPRNT from the Contact box in the menu.
      </p>

      <EditKioskModal
        kiosk={editKiosk}
        onClose={() => setEditKiosk(null)}
        onSaved={() => {
          setEditKiosk(null);
          setToast({ message: 'QR point updated', tone: 'success' });
          reloadAll();
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function QrPointCard({
  kiosk,
  printers,
  canManage,
  onEdit,
  onTurnOff,
}: {
  kiosk: KioskRow;
  printers: PrinterRow[];
  canManage: boolean;
  onEdit: () => void;
  onTurnOff: (p: PrinterRow) => void;
}) {
  const state = qrState(kiosk);
  return (
    <Card as="section" className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text">{kiosk.name}</h2>
          {kiosk.location && <p className="text-sm text-text-muted">{kiosk.location}</p>}
          <p className="mt-2 text-sm text-text">{state.detail}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <StateBadge label={state.label} tone={state.tone} />
          {canManage && (
            <Button size="sm" variant="secondary" onClick={onEdit} aria-label={`Change the name of ${kiosk.name}`}>
              Change name
            </Button>
          )}
        </div>
      </div>

      {printers.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border/70">
          {printers.map((p) => (
            <PrinterLine key={p.printerId} printer={p} canManage={canManage} onTurnOff={onTurnOff} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-border/70 px-4 py-4 text-sm text-text-muted sm:px-5">
          No printer is connected here yet.
        </p>
      )}

      <div className="border-t border-border/70 px-4 py-2 sm:px-5">
        <TechnicalDetails>
          <p>QR code ID: {kiosk.kioskId}</p>
        </TechnicalDetails>
      </div>
    </Card>
  );
}

function PrinterLine({
  printer: p,
  canManage,
  onTurnOff,
}: {
  printer: PrinterRow;
  canManage: boolean;
  onTurnOff: (p: PrinterRow) => void;
}) {
  const state = printerState(p);
  const off = p.status === 'revoked';
  const low = !off && p.paperLevel !== null && p.paperLevel < LOW_PAPER;

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex-shrink-0">
          <PaperTank value={off ? null : p.paperLevel} live={state.tone === 'good' || state.tone === 'info'} width={30} height={56} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-text">{p.station.label}</p>
          <p className="text-xs text-text-muted">
            {p.capabilities.color ? 'Colour' : 'Black and white only'}
            {' · '}
            {p.capabilities.doubleSided ? 'double-sided' : 'single-sided only'}
          </p>
          <div className="mt-2">
            <StateBadge label={state.label} tone={state.tone} />
          </div>
          <p className="mt-1.5 text-sm text-text-muted">{state.detail}</p>
          {low && <p className="mt-1 text-sm font-medium text-warning">Paper is low. Refill the tray soon.</p>}
          <p className="mt-1 text-xs text-text-muted">
            Paper: {p.paperLevel !== null ? `${p.paperLevel}% left` : 'not reported'}
            {' · '}
            Ink: {p.inkLevelBlack !== null ? `${p.inkLevelBlack}% left` : 'not reported'}
          </p>
          <div className="mt-2">
            <TechnicalDetails>
              <p>Printer ID: {p.printerId}</p>
              {p.station.isStation && p.name && <p>Name on the printer: {p.name}</p>}
            </TechnicalDetails>
          </div>
        </div>
      </div>

      {canManage && !off && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-error sm:self-center"
          onClick={() => onTurnOff(p)}
          aria-label={`Turn off ${p.station.label}`}
        >
          Turn off
        </Button>
      )}
    </li>
  );
}
