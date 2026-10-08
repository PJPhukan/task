'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MailCheck } from 'lucide-react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Email address is required. Enter your registered email.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/auth/request-password-reset', {
        email: email.trim(),
        redirectTo: '/reset-password',
      });
      setIsSubmitted(true);
    } catch {
      // Even on potential error, Better Auth usually returns 200, but if network fails:
      setErrorMessage('Network connection lost. Verify your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <div className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-foreground mb-4 ring-1 ring-brand/20">
          <MailCheck className="size-5" />
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we have sent a link to reset your password.
        </p>

        <div className="mt-4 w-full rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
          <p className="text-[11px] font-medium text-foreground">Next step:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Open your email inbox and click the reset link to choose a new password. If you do not see it within two minutes, check your spam folder.
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && (
        <div
          role="alert"
          className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="forgot-email"
          className="text-xs font-medium text-foreground"
        >
          Email address
        </label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isSubmitting}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-9 w-full bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sending link...
          </>
        ) : (
          'Send reset link'
        )}
      </Button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Remembered your password?{' '}
        <Link
          href="/sign-in"
          className="font-medium text-foreground transition-colors hover:underline"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
}
