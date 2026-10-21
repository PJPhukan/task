'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useCurrentUser } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useCurrentUser();
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

        if (
          code === 'INVALID_EMAIL_OR_PASSWORD' ||
          msg.includes('Invalid email or password') ||
          code === 'EMAIL_NOT_VERIFIED' ||
          msg.toLowerCase().includes('verified')
        ) {
          setErrorMessage('Incorrect email address or password.');
        } else if (code === 'ACCOUNT_PENDING') {
          setErrorMessage('Your account is pending administrator approval. You will receive an email once approved.');
        } else if (code === 'ACCOUNT_REJECTED') {
          setErrorMessage('Your account request was not approved. Contact your workspace administrator.');
        } else {
          setErrorMessage(msg || 'Authentication failed. Check your details and try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Reload the app-wide user so route guards see the new session
      await refresh();

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
        // If /api/me check fails, proceed to returnTo
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setErrorMessage('Network connection lost. Verify your connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </div>
      )}

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
          placeholder="name@example.com"
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
          placeholder="Password"
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

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Need an account?{' '}
        <Link
          href="/sign-up"
          className="font-medium text-foreground transition-colors hover:underline"
        >
          Request access
        </Link>
      </div>
    </form>
  );
}
