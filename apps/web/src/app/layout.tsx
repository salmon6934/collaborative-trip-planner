import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

/**
 * Editorial display serif for the wordmark and page-section headings. Exposed as
 * a CSS variable so globals.css can wire it into the `font-display` token; body
 * copy stays on the system sans stack (see --font-sans in globals.css).
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: 'TripSync',
  description: 'Plan trips together in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
