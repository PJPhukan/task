import * as React from 'react';
import { Suspense } from 'react';
import { BRAND } from '@/lib/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { cn } from '@/lib/utils';

export const metadata = {
  title: `Forgot password — ${BRAND.name}`,
  description: `Reset your password on ${BRAND.name}.`,
};

export default async function ForgotPasswordPage({
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
        'min-h-screen bg-background text-foreground flex flex-col items-center justify-start pt-16 sm:pt-[max(3.5rem,calc(40vh-200px))] pb-12 px-4',
        themeClass
      )}
    >
      <div className="w-full max-w-[360px] rounded border border-border bg-card p-6">
        {/* Brand header with inline theme toggle */}
        <div className="flex items-center justify-between pb-5 border-b border-border/80">
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

        {/* Heading */}
        <div className="pt-5 pb-4">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Forgot password
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {/* Form */}
        <Suspense
          fallback={
            <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
              Loading...
            </div>
          }
        >
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
