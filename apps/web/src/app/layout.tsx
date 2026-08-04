import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth-context';

import './globals.css';

/**
 * Fonts are fetched at build time and served from our own origin.
 *
 * The previous `<link>` to fonts.googleapis.com was render-blocking on a
 * third-party host: the browser had to resolve DNS, open a TLS connection,
 * download a stylesheet, and only then discover the actual font files on a
 * *second* host (fonts.gstatic.com) — all before it would paint any text.
 * Self-hosting collapses that to bytes already on the connection the page
 * came from, and `display: swap` means text is never invisible while a face
 * is still loading.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AYV OS — Ad Your Vision',
  description: 'The operating system of Ad Your Vision.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
