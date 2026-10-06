import type { Metadata } from 'next';
import { RootProvider } from '@/providers/root-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task Manager',
  description: 'Internal Jira-style task management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
