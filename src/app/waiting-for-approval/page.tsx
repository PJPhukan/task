import * as React from 'react';
import { Clock } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export const metadata = {
  title: `Waiting for approval — ${BRAND.name}`,
  description: `Your account is waiting for administrator approval on ${BRAND.name}.`,
};

export default async function WaitingForApprovalPage({
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
        {/* Brand header with inline theme toggle only */}
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

        {/* Content - No external or return navigation per strict specification */}
        <div className="pt-6 pb-4 flex flex-col items-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-foreground mb-4 ring-1 ring-brand/20">
            <Clock className="size-5" />
          </div>

          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Waiting for approval
          </h1>

          <div className="mt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              An administrator has been told of your request.
            </p>
            <p>
              An email will follow once your account has been reviewed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
