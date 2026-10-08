'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2, AlertCircle, UserPlus } from 'lucide-react';

interface InviteValidation {
  email: string;
  invitedBy?: string;
}

export function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteValidation | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidationError('No invitation token was provided in this link.');
      setIsLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const data = await apiClient.get<InviteValidation>(
          `/api/invites/accept?token=${encodeURIComponent(token)}`
        );
        setInviteData(data);
      } catch (err: any) {
        setValidationError(
          err?.message || 'This invitation link is invalid or has expired.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
        <Loader2 className="mb-2 size-5 animate-spin text-brand" />
        <span>Validating invitation link...</span>
      </div>
    );
  }

  if (validationError || !inviteData) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <div className="flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger mb-4 ring-1 ring-danger/20">
          <AlertCircle className="size-5" />
        </div>

        <h2 className="text-sm font-semibold text-foreground">
          Invalid invitation
        </h2>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {validationError || 'This invitation link is invalid or has expired.'}
        </p>

        <div className="mt-4 w-full rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
          <p className="text-[11px] font-medium text-foreground">Next step:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Contact the workspace administrator who invited you to request a new invitation link.
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Full name is required. Enter your name.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters. Choose a stronger password.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Re-enter the identical password in both fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/invites/accept', {
        token,
        name: name.trim(),
        password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setFormError(
        err?.message || 'Failed to accept invitation. Verify your details and try again.'
      );
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
          Welcome to {BRAND.name}
        </h2>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Your invitation has been accepted and your account is active.
        </p>

        <div className="mt-4 w-full rounded-sm border border-border/80 bg-muted/40 p-3 text-left">
          <p className="text-[11px] font-medium text-foreground">Next step:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Sign in with your email address and password to start reviewing tasks.
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
      {formError && (
        <div
          role="alert"
          className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {formError}
        </div>
      )}

      {/* Inviter banner */}
      <div className="rounded-sm border border-border/80 bg-muted/40 p-3 flex items-start gap-2.5">
        <UserPlus className="size-4 shrink-0 text-brand mt-0.5" />
        <div className="text-xs text-muted-foreground">
          {inviteData.invitedBy ? (
            <p>
              <strong className="text-foreground">{inviteData.invitedBy}</strong> has invited you to join this workspace.
            </p>
          ) : (
            <p>You have been invited to join this workspace.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="invite-email"
          className="text-xs font-medium text-foreground"
        >
          Email address
        </label>
        <Input
          id="invite-email"
          type="email"
          disabled
          value={inviteData.email}
          className="h-9 bg-muted/60 text-muted-foreground cursor-not-allowed"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="invite-name"
          className="text-xs font-medium text-foreground"
        >
          Full name
        </label>
        <Input
          id="invite-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={isSubmitting}
          placeholder="First and last name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="invite-password"
          className="text-xs font-medium text-foreground"
        >
          Password
        </label>
        <Input
          id="invite-password"
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
          htmlFor="invite-confirm-password"
          className="text-xs font-medium text-foreground"
        >
          Confirm password
        </label>
        <Input
          id="invite-confirm-password"
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
            Accepting invitation...
          </>
        ) : (
          'Accept invitation'
        )}
      </Button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Already have an active account?{' '}
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
