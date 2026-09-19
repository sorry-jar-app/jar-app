import type { Metadata, Viewport } from 'next';
import { Caprasimo, Figtree } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { StoreProvider } from '@/lib/store';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

/**
 * Self-hosted through next/font, so the Capacitor build has its type with no
 * network. The CSS variables are what organic.css reads.
 */
const caprasimo = Caprasimo({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caprasimo',
});

const figtree = Figtree({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  title: 'Sorry Jar',
  description:
    'A shared jar for the small stuff. Set your rules, log the fines, spend it on something you both like.',
  applicationName: 'Sorry Jar',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Sorry Jar',
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
  themeColor: '#f7f1e8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-palette="Mulberry" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
