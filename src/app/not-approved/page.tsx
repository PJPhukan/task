import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata = {
  title: `Not approved — ${BRAND.name}`,
  description: `Account access was not approved for ${BRAND.name}.`,
};

export default async function NotApprovedPage({
  searchParams,
}: {
  searchParams?: Promise<{ theme?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const theme = resolvedParams.theme;
  const themeClass = theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : '';

  return (
    <div
      className={cn(
        'min-h-screen bg-background text-foreground flex flex-col items-center justify-start pt-16 sm:pt-[max(3.5rem,calc(40vh-190px))] pb-12 px-4',
        themeClass
      )}
    >
      <div className="w-full max-w-[360px] rounded border border-border bg-card p-6 text-center">
        {/* Brand header with inline theme toggle */}
        <div className="flex items-center justify-between pb-5 border-b border-border/80 text-left">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-sm bg-brand text-brand-foreground font-semibold text-xs">
              R
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {BRAND.name}
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Content */}
        <div className="pt-6 pb-2 flex flex-col items-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4 ring-1 ring-destructive/20">
            <ShieldAlert className="size-5" />
          </div>

          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Account not approved
          </h1>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Your request to join this workspace was not approved by an administrator.
          </p>

          <div className="mt-4 rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
            <p className="text-[11px] font-medium text-foreground">
              Next step:
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Contact your workspace administrator or team lead to review your account or request an updated invitation.
            </p>
          </div>

          <div className="mt-6 w-full">
            <Button
              nativeButton={false}
              render={
                <Link
                  href="/sign-in"
                  className="w-full justify-center bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  Return to sign in
                </Link>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
