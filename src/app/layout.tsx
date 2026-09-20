import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/AppShell';
import { StoreProvider } from '@/lib/store';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Digi Jar',
  description:
    'A shared jar for the small stuff. Set your rules, log the fines, spend it on something you both like.',
  applicationName: 'Digi Jar',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Digi Jar',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f7f7f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      glass-light is the server's guess. The store corrects it on mount from
      the saved preference, and falls back to the system setting. Written here
      rather than left blank so the first painted frame is a real theme and not
      an unstyled one.
    */
    <html lang="en" className="light" data-theme="glass-light" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
