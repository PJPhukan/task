'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ResetPasswordFormProps {
  initialToken?: string;
}

export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const searchParams = useSearchParams();
  const token = initialToken || searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <div className="flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger mb-4 ring-1 ring-danger/20">
          <AlertCircle className="size-5" />
        </div>

        <h2 className="text-sm font-semibold text-foreground">
          Missing reset token
        </h2>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          No password reset token was found in this link.
        </p>

        <div className="mt-4 w-full rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
          <p className="text-[11px] font-medium text-foreground">Next step:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Request a fresh password reset link from the forgot password page.
          </p>
        </div>

        <div className="mt-6 w-full">
          <Button
            nativeButton={false}
            render={
              <Link
                href="/forgot-password"
                className="w-full justify-center bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Request reset link
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters. Choose a stronger password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Re-enter the identical password in both fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/auth/reset-password', {
        token,
        newPassword: password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setErrorMessage('This reset token is invalid or has expired. Request a new password reset link.');
      } else {
        setErrorMessage(msg || 'Unable to reset password. Check your details and try again.');
      }
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <div className="flex size-11 items-center justify-center rounded-full bg-success/10 text-success mb-4 ring-1 ring-success/20">
          <CheckCircle2 className="size-5" />
        </div>

        <h2 className="text-sm font-semibold text-foreground">
          Password updated
        </h2>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Your password has been reset successfully.
        </p>

        <div className="mt-4 w-full rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
          <p className="text-[11px] font-medium text-foreground">Next step:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Sign in using your email address and your new password.
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
                Sign in
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
          htmlFor="new-password"
          className="text-xs font-medium text-foreground"
        >
          New password
        </label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isSubmitting}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm-password"
          className="text-xs font-medium text-foreground"
        >
          Confirm new password
        </label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={isSubmitting}
          placeholder="Repeat password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
            Resetting password...
          </>
        ) : (
          'Reset password'
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
