'use client';

import * as React from 'react';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResendVerificationActionProps {
  defaultEmail?: string;
}

export function ResendVerificationAction({ defaultEmail = '' }: ResendVerificationActionProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) {
      setStatus({ type: 'error', message: 'Please provide your email address to resend.' });
      return;
    }

    setIsLoading(false);
    setIsLoading(true);
    setStatus(null);

    try {
      const res = await authClient.sendVerificationEmail({
        email: targetEmail,
        callbackURL: '/email-verified',
      });

      if (res?.error) {
        setStatus({
          type: 'error',
          message: res.error.message || 'Failed to resend verification email.',
        });
      } else {
        setStatus({
          type: 'success',
          message: `Verification email resent to ${targetEmail}. Please check your inbox.`,
        });
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err?.message || 'Failed to resend verification email. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 w-full text-left space-y-2.5">
      {!defaultEmail && (
        <div className="space-y-1">
          <label htmlFor="resend-email-input" className="text-[11px] font-medium text-foreground">
            Account email
          </label>
          <Input
            id="resend-email-input"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="h-8 text-xs"
          />
        </div>
      )}

      {status && (
        <div
          role="status"
          className={`rounded-sm border px-3 py-2 text-xs flex items-center gap-2 ${
            status.type === 'success'
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-danger/40 bg-danger/10 text-danger'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="size-3.5 shrink-0" />
          ) : (
            <AlertCircle className="size-3.5 shrink-0" />
          )}
          <span className="leading-tight">{status.message}</span>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={handleResend}
        className="w-full justify-center h-8 text-xs gap-1.5"
      >
        <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        <span>Resend verification email</span>
      </Button>
    </div>
  );
}
