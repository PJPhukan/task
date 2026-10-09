'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Loader2, RefreshCw, Trash2, CheckCircle2, FolderKanban, LayoutGrid } from 'lucide-react';
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

interface ProjectOption {
  id: string;
  name: string;
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
        const [rolesData, invitesData, projectsData] = await Promise.all([
          apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
          apiClient.get<{ invites: PendingInvite[] }>('/api/invites'),
          apiClient.get<{ projects: ProjectOption[] }>('/api/projects').catch(() => ({ projects: [] })),
        ]);

        const loadedRoles = rolesData.roles || [];
        setRoles(loadedRoles);
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

    if (!selectedProjectId) {
      setErrorMessage('Please select at least one project so the invited user does not land in an empty workspace.');
      return;
    }

    if (!selectedBoardId) {
      setErrorMessage('Please select at least one board so the invited user has immediate access to tasks.');
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

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invites" description="Team invitation management" />
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading invitation management...
        </div>
      </div>
    );
  }

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

        <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
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
                className="h-9 text-xs"
              />
            </div>

            {/* Role Select */}
            <div className="flex flex-col gap-1.5">
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
                className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  <>
                    <option value="">-- Select project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                className="h-9 rounded-sm border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isLoadingBoards ? (
                  <option value="">Loading boards...</option>
                ) : boards.length === 0 ? (
                  <option value="">No boards available</option>
                ) : (
                  <>
                    <option value="">-- Select board --</option>
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">
              Invited users are automatically granted workspace membership and access to the selected board.
            </p>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs whitespace-nowrap shrink-0"
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
