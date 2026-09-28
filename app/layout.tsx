import type { Metadata, Viewport } from 'next';
import { ThemeScript } from '@/components/ThemeScript';
import './globals.css';

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
    { media: '(prefers-color-scheme: light)', color: '#fcfcfa' },
    { media: '(prefers-color-scheme: dark)', color: '#141412' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
