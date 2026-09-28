'use client';

import React from 'react';
import { Icon } from '@/components/Icon';

type Mode = 'light' | 'dark' | 'system';

/**
 * Cycles light → dark → system.
 *
 * "System" is the default and is a real option, not a fallback: someone whose
 * OS switches to dark at night expects this to follow. The choice persists in
 * localStorage, which is appropriate here — it is a per-device preference, not
 * account state.
 */
export function ThemeToggle() {
  const [mode, setMode] = React.useState<Mode>('system');

  React.useEffect(() => {
    const stored = (localStorage.getItem('mprnt-theme') as Mode) || 'system';
    setMode(stored);
  }, []);

  React.useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = mode === 'dark' || (mode === 'system' && prefersDark);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };

    apply();

    // Only track the OS while following it.
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  function cycle() {
    const next: Mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
    localStorage.setItem('mprnt-theme', next);
  }

  const label =
    mode === 'light' ? 'Light theme' : mode === 'dark' ? 'Dark theme' : 'Follows system theme';

  return (
    <button
      onClick={cycle}
      title={label}
      aria-label={`${label}. Activate to change.`}
      className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-secondary transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
    >
      {mode === 'dark' ? (
        <Icon name="moon" className="w-5 h-5" />
      ) : mode === 'light' ? (
        <Icon name="sun" className="w-5 h-5" />
      ) : (
        <span className="relative flex items-center justify-center w-5 h-5">
          <Icon name="sun" className="w-5 h-5" />
          <span className="absolute -bottom-1 -right-1 text-[8px] font-bold" aria-hidden="true">
            A
          </span>
        </span>
      )}
    </button>
  );
}
