'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Mail, Plus, Loader2, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface RoleOption {
  id: string;
  displayName: string;
}

interface PendingInvite {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  roles?: { id: string; displayName?: string }[];
  roleIds?: string[];
  invitedBy?: { name?: string } | string;
}

export default function InvitesPage() {
  const { can } = useCurrentUser();
  const canManageUsers = can('user.manage');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('developer');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchInvites = React.useCallback(async () => {
    try {
      const data = await apiClient.get<{ invites: PendingInvite[] }>('/api/invites');
      setInvites(data.invites || []);
    } catch {
      // Failed to list
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [rolesData, invitesData] = await Promise.all([
          apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
          apiClient.get<{ invites: PendingInvite[] }>('/api/invites'),
        ]);
        setRoles(rolesData.roles || []);
        setInvites(invitesData.invites || []);
      } catch {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSendInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Email address is required. Enter the recipient work email.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/invites', {
        email: email.trim(),
        roleIds: [selectedRole],
      });

      setSuccessMessage(`Invitation dispatched to ${email.trim()}.`);
      setEmail('');
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to dispatch invitation. Verify details and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      await apiClient.post(`/api/invites/${id}/resend`);
      setSuccessMessage('Invitation link refreshed and resent.');
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend invite.');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiClient.delete(`/api/invites/${id}`);
      setSuccessMessage('Invitation revoked.');
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to revoke invite.');
    }
  };

  if (!canManageUsers) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invites" description="Team invitation management" />
        <div className="rounded-sm border border-danger/30 bg-danger/5 p-6 text-center">
          <h2 className="text-sm font-semibold text-foreground">Access denied</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You do not have permission to manage workspace users or send invitations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invites"
        description="Invite new team members and assign their starting role"
      />

      {/* Invite Form Card */}
      <div className="rounded-sm border border-border bg-card p-5">
        <div className="flex items-center gap-2 pb-4 border-b border-border/80">
          <Mail className="size-4 text-brand" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Send an invitation
          </h2>
        </div>

        {successMessage && (
          <div
            role="status"
            className="mt-4 rounded-sm border border-success/40 bg-success/10 px-3 py-2 text-xs text-success flex items-center gap-2"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSendInvite} className="mt-4 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label htmlFor="invite-email-input" className="text-xs font-medium text-foreground">
              Recipient email
            </label>
            <Input
              id="invite-email-input"
              type="email"
              required
              disabled={isSubmitting}
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full sm:w-48">
            <label htmlFor="invite-role-select" className="text-xs font-medium text-foreground">
              Assigned role
            </label>
            <select
              id="invite-role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={isSubmitting}
              className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-9 bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Send invite
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Pending Invites List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invitations ({invites.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Loading invitations...
          </div>
        ) : invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No pending invitations"
            description="All dispatched invitations have been accepted or revoked."
            nextActionText="Send an invitation above to onboard new teammates to the board."
            className="my-4"
          />
        ) : (
          <div className="rounded-sm border border-border bg-card divide-y divide-border/60">
            {invites.map((inv) => (
              <div key={inv.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{inv.email}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                      {inv.roles?.map(r => r.displayName || r.id).join(', ') || inv.roleIds?.join(', ') || 'Developer'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Invited on {new Date(inv.createdAt).toLocaleDateString()}
                    {inv.invitedBy && ` by ${typeof inv.invitedBy === 'string' ? inv.invitedBy : inv.invitedBy.name}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResend(inv.id)}
                    className="gap-1 text-xs h-7 px-2"
                  >
                    <RefreshCw className="size-3" />
                    <span>Resend</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(inv.id)}
                    className="gap-1 text-xs text-danger hover:text-danger h-7 px-2"
                  >
                    <Trash2 className="size-3" />
                    <span>Revoke</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
