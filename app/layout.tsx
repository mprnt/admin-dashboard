import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { ThemeScript } from '@/components/ThemeScript';
import './globals.css';

// Self-hosted at build time by next/font, so there is no runtime request to
// Google and no layout shift while the font loads.
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MPrnt Admin',
  description: 'Manage kiosks, printers, staff and revenue',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Unlike the kiosk flow, zoom is NOT disabled here. This dashboard shows
  // dense tables and small figures; pinch-zoom is how people with low vision
  // read them, and taking it away fails WCAG 1.4.4.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#111110' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
