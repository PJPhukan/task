import type { Metadata } from 'next';
import { RootProvider } from '@/providers/root-provider';
import './globals.css';
import { IBM_Plex_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('font-sans', ibmPlexSans.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-brand/15">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
