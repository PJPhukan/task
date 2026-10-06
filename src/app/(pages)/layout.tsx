import { AppShell } from '@/components/app-shell/app-shell';

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
