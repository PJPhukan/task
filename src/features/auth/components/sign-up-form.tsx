'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export function SignUpForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Name is required. Enter your full name.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Email address is required. Enter a valid work email.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters. Choose a stronger password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (response.error) {
        const msg = response.error.message || '';
        const code = response.error.code || '';

        if (code === 'USER_ALREADY_EXISTS' || msg.toLowerCase().includes('already exists')) {
          setErrorMessage('An account with this email already exists. Sign in or reset your password.');
        } else if (msg.toLowerCase().includes('password')) {
          setErrorMessage('Password is too weak. Use at least 8 characters.');
        } else {
          setErrorMessage(msg || 'Unable to create account. Verify your details and try again.');
        }
        setIsSubmitting(false);
        return;
      }

      router.push(`/check-email?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setErrorMessage('Network connection lost. Check your connection and try again.');
      setIsSubmitting(false);
    }
  };

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
          htmlFor="signup-name"
          className="text-xs font-medium text-foreground"
        >
          Full name
        </label>
        <Input
          id="signup-name"
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
          htmlFor="signup-email"
          className="text-xs font-medium text-foreground"
        >
          Email address
        </label>
        <Input
          id="signup-email"
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
        <label
          htmlFor="signup-password"
          className="text-xs font-medium text-foreground"
        >
          Password
        </label>
        <Input
          id="signup-password"
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

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-9 w-full bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </Button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
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
