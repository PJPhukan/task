import * as React from 'react';
import { Suspense } from 'react';
import { BRAND } from '@/lib/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { CheckSquare, Clock, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata = {
  title: `Sign in — ${BRAND.name}`,
  description: `Sign in to ${BRAND.name} to manage role-driven tasks and stage dwell times.`,
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ theme?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const theme = resolvedParams.theme;
  const themeClass = theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : '';

  return (
    <div className={cn('flex min-h-screen flex-col bg-background text-foreground', themeClass)}>
      {/* Top utility bar */}
      <header className="flex h-12 w-full items-center justify-between border-b border-border px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-sm bg-brand text-brand-foreground font-semibold text-xs">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {BRAND.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main container */}
      <main className="flex flex-1 items-center justify-center p-3 sm:p-8">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded border border-border bg-card lg:grid-cols-12">
          {/* Left panel: Product premise and stage model */}
          <div className="flex flex-col justify-between border-b border-border bg-muted/20 p-5 sm:p-8 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-brand/20 bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  <ShieldCheck className="size-3.5" />
                  <span>Stage custody system</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                  {BRAND.name}
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {BRAND.tagline}. Every column is owned by a role. Tickets transition
                  between Developer, QA, and Deployment with live dwell time tracking.
                </p>
              </div>

              {/* Operating invariants list */}
              <div className="hidden sm:flex flex-col gap-3 border-t border-border/80 pt-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">Role ownership</span>
                    <span className="text-muted-foreground">
                      Columns belong to roles. Only assigned disciplines can pull or advance work.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">Live dwell time limits</span>
                    <span className="text-muted-foreground">
                      Stages log wait time in seconds and flag bottlenecks when limits expire.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">Documented bounce-backs</span>
                    <span className="text-muted-foreground">
                      Moving backward to a previous column requires an explicit reason.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage indicator preview */}
            <div className="hidden sm:flex flex-col gap-2 border-t border-border/80 pt-4">
              <span className="text-[11px] font-medium text-muted-foreground">
                Active stage disciplines
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <span className="mr-1.5 size-1.5 rounded-full bg-brand" />
                  Developer
                </span>
                <span className="inline-flex items-center rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <span className="mr-1.5 size-1.5 rounded-full bg-priority-medium" />
                  QA
                </span>
                <span className="inline-flex items-center rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
                  <span className="mr-1.5 size-1.5 rounded-full bg-priority-high" />
                  Deployment
                </span>
              </div>
            </div>
          </div>

          {/* Right panel: Sign-in form */}
          <div className="p-5 sm:p-8 lg:col-span-7">
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
                  Loading form...
                </div>
              }
            >
              <SignInForm />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Quiet footer */}
      <footer className="flex h-10 w-full items-center justify-between border-t border-border px-4 text-xs text-muted-foreground sm:px-8">
        <span>{BRAND.name} workspace</span>
        <span className="tabular-nums">v1.0.0</span>
      </footer>
    </div>
  );
}
