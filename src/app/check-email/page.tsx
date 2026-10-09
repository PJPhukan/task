import * as React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ResendVerificationAction } from '@/features/auth/components/resend-verification-action';

export const metadata = {
  title: `Check your email — ${BRAND.name}`,
  description: `Verification link sent for ${BRAND.name}.`,
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; theme?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const email = resolvedParams.email;
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
          <div className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-foreground mb-4 ring-1 ring-brand/20">
            <Mail className="size-5" />
          </div>

          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Check your email
          </h1>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {email ? (
              <>
                We sent a verification link to{' '}
                <span className="font-medium text-foreground">{email}</span>.
              </>
            ) : (
              'We sent a verification link to your email address.'
            )}
          </p>

          <div className="mt-4 rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
            <p className="text-[11px] font-medium text-foreground">
              Check your inbox:
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Open your email inbox and click the verification link. If you do not see it within two minutes, check your spam folder or click resend below.
            </p>
          </div>

          <ResendVerificationAction defaultEmail={email} />

          <div className="mt-4 w-full">
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
