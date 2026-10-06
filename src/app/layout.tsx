import type { Metadata } from 'next';
import { RootProvider } from '@/providers/root-provider';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
