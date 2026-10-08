'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface SeededAccount {
  label: string;
  email: string;
  role: string;
}

const SEEDED_ACCOUNTS: SeededAccount[] = [
  { label: 'Admin', email: 'admin@example.com', role: 'Full access' },
  { label: 'Developer', email: 'developer@example.com', role: 'Dev columns' },
  { label: 'QA', email: 'qa@example.com', role: 'Testing columns' },
  { label: 'Deployment', email: 'deployment@example.com', role: 'Release columns' },
  { label: 'Manager', email: 'manager@example.com', role: 'Project management' },
  { label: 'Member', email: 'member@example.com', role: 'Standard team' },
  { label: 'Viewer', email: 'viewer@example.com', role: 'Read only' },
];

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/my-tasks';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please fill in both email address and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (response.error) {
        const code = response.error.code || '';
        const msg = response.error.message || '';

        if (code === 'INVALID_EMAIL_OR_PASSWORD' || msg.includes('Invalid email or password')) {
          setErrorMessage('Incorrect email address or password. Verify your credentials or reset your password.');
        } else if (code === 'EMAIL_NOT_VERIFIED' || msg.includes('verified')) {
          setErrorMessage('Your email address is not verified. Check your inbox for the confirmation link.');
        } else if (code === 'ACCOUNT_PENDING') {
          setErrorMessage('Your account is pending administrator approval. You will receive an email once approved.');
        } else if (code === 'ACCOUNT_REJECTED') {
          setErrorMessage('Your account request was not approved. Contact your workspace administrator for assistance.');
        } else {
          setErrorMessage(msg || 'Authentication failed. Check your details and try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Check account status via /api/me
      try {
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          const status = meData?.user?.status;
          if (status === 'PENDING') {
            router.push('/waiting-for-approval');
            return;
          }
          if (status === 'REJECTED') {
            router.push('/not-approved');
            return;
          }
        }
      } catch {
        // If /api/me check fails, continue to intended destination
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setErrorMessage('Network connection lost. Verify your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleSelectSeeded = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword('development123');
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Sign in to your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your team credentials to access your task board.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2.5 text-xs text-danger"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email-input"
            className="text-xs font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isSubmitting}
            placeholder="developer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password-input"
              className="text-xs font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
        <span className="text-muted-foreground">Need an account?</span>
        <Link
          href="/sign-up"
          className="font-medium text-foreground transition-colors hover:underline"
        >
          Request access
        </Link>
      </div>

      {/* Dev helper for seeded users */}
      <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            Development seeded accounts
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            password: development123
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {SEEDED_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => handleSelectSeeded(acc.email)}
              className="flex flex-col items-start rounded-sm border border-border/60 bg-card px-2 py-1.5 text-left text-xs transition-colors hover:border-brand/40 hover:bg-muted"
            >
              <span className="font-medium text-foreground">{acc.label}</span>
              <span className="text-[11px] text-muted-foreground">{acc.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
