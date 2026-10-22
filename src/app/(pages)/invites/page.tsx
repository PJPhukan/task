'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Plus,
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle2,
  FolderKanban,
  LayoutGrid,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatAppDate } from '@/lib/format-time';
import { fetchRoleUserCounts, formatSortedRoles } from '@/lib/role-helpers';

interface RoleOption {
  id: string;
  displayName: string;
}

interface ProjectOption {
  id: string;
  name: string;
  key: string;
}

interface BoardOption {
  id: string;
  name: string;
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
  const { can, isLoading: isAuthLoading } = useCurrentUser();
  const canManageUsers = can('user.manage');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [roleSearch, setRoleSearch] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('developer');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Revoke confirmation dialog state
  const [inviteToRevoke, setInviteToRevoke] = useState<PendingInvite | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchInvites = useCallback(async () => {
    try {
      const data = await apiClient.get<{ invites: PendingInvite[] }>('/api/invites');
      setInvites(data.invites || []);
    } catch {
      // Failed to list
    }
  }, []);

  // Fetch initial roles, projects, and existing invites
  useEffect(() => {
    async function loadData() {
      try {
        const [rolesData, invitesData, projectsData, counts] = await Promise.all([
          apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
          apiClient.get<{ invites: PendingInvite[] }>('/api/invites'),
          apiClient.get<{ projects: ProjectOption[] }>('/api/projects').catch(() => ({ projects: [] })),
          fetchRoleUserCounts(),
        ]);

        const loadedRoles = rolesData.roles || [];
        setRoles(loadedRoles);
        setRoleCounts(counts);

        if (loadedRoles.some((r) => r.id === 'developer')) {
          setSelectedRole('developer');
        } else if (loadedRoles.length > 0) {
          setSelectedRole(loadedRoles[0].id);
        }

        setInvites(invitesData.invites || []);

        const loadedProjects = projectsData.projects || [];
        setProjects(loadedProjects);
        if (loadedProjects.length > 0) {
          setSelectedProjectId(loadedProjects[0].id);
        }
      } catch {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const sortedRoles = React.useMemo(() => {
    return formatSortedRoles(roles, roleCounts);
  }, [roles, roleCounts]);

  const filteredRoles = React.useMemo(() => {
    if (!roleSearch.trim()) return sortedRoles;
    const q = roleSearch.toLowerCase().trim();
    return sortedRoles.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [sortedRoles, roleSearch]);

  // Load boards whenever selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setBoards([]);
      setSelectedBoardId('');
      return;
    }

    async function loadBoards() {
      setIsLoadingBoards(true);
      try {
        const data = await apiClient.get<{ boards: BoardOption[] }>(
          `/api/projects/${selectedProjectId}/boards`
        );
        const projectBoards = data.boards || [];
        setBoards(projectBoards);
        if (projectBoards.length > 0) {
          setSelectedBoardId(projectBoards[0].id);
        } else {
          setSelectedBoardId('');
        }
      } catch {
        setBoards([]);
        setSelectedBoardId('');
      } finally {
        setIsLoadingBoards(false);
      }
    }

    loadBoards();
  }, [selectedProjectId]);

  const handleSendInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Email address is required. Enter the recipient work email.');
      return;
    }

    if (!selectedProjectId || !selectedBoardId) {
      setErrorMessage('Choose at least one project and board so the new person has somewhere to work.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/invites', {
        email: email.trim(),
        roleIds: [selectedRole],
        projectIds: [selectedProjectId],
        boardIds: [selectedBoardId],
      });

      setSuccessMessage(`Invitation sent to ${email.trim()}.`);
      setEmail('');
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to send invitation. Verify details and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (id: string, invEmail: string) => {
    try {
      await apiClient.post(`/api/invites/${id}/resend`);
      setSuccessMessage(`Invitation link refreshed and resent to ${invEmail}.`);
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend invite.');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!inviteToRevoke || isRevoking) return;
    setIsRevoking(true);
    try {
      await apiClient.delete(`/api/invites/${inviteToRevoke.id}`);
      setSuccessMessage(`Invitation for ${inviteToRevoke.email} has been revoked.`);
      setInviteToRevoke(null);
      await fetchInvites();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to revoke invite.');
    } finally {
      setIsRevoking(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invites" description="Team invitation management" />
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-sm" />
          <Skeleton className="h-24 w-full rounded-sm" />
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invites" description="Team invitation management" />
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-sm font-semibold text-foreground">Access denied</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You do not have permission to manage workspace users or send invitations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Invites"
        description="Invite new team members and assign their initial role, project, and board"
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
            className="mt-4 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSendInvite} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-email-input" className="text-xs font-medium text-foreground">
                Email address
              </label>
              <Input
                id="invite-email-input"
                type="email"
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Role Select */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-role-select" className="text-xs font-medium text-foreground">
                Assigned role
              </label>
              {roles.length > 7 && (
                <Input
                  placeholder="Search roles..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="h-7 text-xs mb-1"
                />
              )}
              <select
                id="invite-role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={isSubmitting || roles.length === 0}
                className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {filteredRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.labelWithCount}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Select */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-project-select" className="text-xs font-medium text-foreground flex items-center gap-1">
                <FolderKanban className="size-3 text-muted-foreground" />
                <span>Assigned project</span>
              </label>
              <select
                id="invite-project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={isSubmitting || projects.length === 0}
                className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  <>
                    <option value="">-- Select project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.key})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Board Select */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-board-select" className="text-xs font-medium text-foreground flex items-center gap-1">
                <LayoutGrid className="size-3 text-muted-foreground" />
                <span>Assigned board</span>
              </label>
              <select
                id="invite-board-select"
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                disabled={isSubmitting || isLoadingBoards || boards.length === 0}
                className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {isLoadingBoards ? (
                  <option value="">Loading boards...</option>
                ) : boards.length === 0 ? (
                  <option value="">No boards available</option>
                ) : (
                  <>
                    <option value="">-- Select board --</option>
                    {boards.map((b) => {
                      const curProj = projects.find((p) => p.id === selectedProjectId);
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name}{curProj ? ` (${curProj.key})` : ''}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">
              Invited users are automatically granted workspace membership and access to the selected board.
            </p>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs whitespace-nowrap shrink-0 rounded-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Send invite</span>
                </>
              )}
            </Button>
          </div>
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
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 border border-border rounded-sm bg-card space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            ))}
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
            {invites.map((inv) => {
              const inviterName =
                typeof inv.invitedBy === 'string'
                  ? inv.invitedBy
                  : inv.invitedBy?.name || 'Administrator';
              const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
              const formattedExpiry = formatAppDate(inv.expiresAt);

              return (
                <div
                  key={inv.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{inv.email}</span>
                      <Badge
                        variant={isExpired ? 'destructive' : 'secondary'}
                        className="text-[10px] font-semibold rounded-sm"
                      >
                        {isExpired ? 'Expired' : 'Pending'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-semibold rounded-sm text-muted-foreground">
                        {inv.roles?.map((r) => r.displayName || r.id).join(', ') ||
                          inv.roleIds?.join(', ') ||
                          'Developer'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span>Sent by {inviterName}</span>
                      <span>•</span>
                      <span>{isExpired ? 'Expired' : 'Expires'} {formattedExpiry}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isExpired ? (
                      <Button
                        id={`send-again-invite-${inv.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleResend(inv.id, inv.email)}
                        className="gap-1 text-xs h-7 px-2.5 rounded-sm"
                      >
                        <RefreshCw className="size-3" />
                        <span>Send again</span>
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(inv.id, inv.email)}
                          className="gap-1 text-xs h-7 px-2.5 rounded-sm"
                        >
                          <RefreshCw className="size-3" />
                          <span>Resend</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInviteToRevoke(inv)}
                          className="gap-1 text-xs text-destructive hover:bg-destructive/10 h-7 px-2.5 rounded-sm"
                        >
                          <Trash2 className="size-3" />
                          <span>Revoke</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke Invite Confirmation Dialog */}
      <Dialog
        open={Boolean(inviteToRevoke)}
        onOpenChange={(open) => !open && setInviteToRevoke(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Revoke invitation</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Revoke invitation for {inviteToRevoke?.email}? They will no longer be able to use this link to sign up.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInviteToRevoke(null)}
              disabled={isRevoking}
            >
              Cancel
            </Button>
            <Button
              id="confirm-revoke-invite-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking...' : 'Revoke invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
