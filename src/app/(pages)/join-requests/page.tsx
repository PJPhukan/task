'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Check,
  X,
  Loader2,
  FolderKanban,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

interface PendingJoinRequest {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}

export default function JoinRequestsPage() {
  const { can, isLoading: isAuthLoading } = useCurrentUser();
  const canManageUsers = can('user.manage');

  const [requests, setRequests] = useState<PendingJoinRequest[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectBoards, setProjectBoards] = useState<Record<string, BoardOption[]>>({});

  // Per-user selection state: userId -> { roleId, projectId, boardId }
  const [selections, setSelections] = useState<
    Record<string, { roleId: string; projectId: string; boardId: string }>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reject dialog state
  const [userToReject, setUserToReject] = useState<PendingJoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiClient.get<{ joinRequests: PendingJoinRequest[] }>('/api/join-requests');
      const sorted = (data.joinRequests || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setRequests(sorted);
    } catch {
      // Failed to list
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [reqsData, rolesData, projectsData, counts] = await Promise.all([
          apiClient.get<{ joinRequests: PendingJoinRequest[] }>('/api/join-requests'),
          apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
          apiClient.get<{ projects: ProjectOption[] }>('/api/projects').catch(() => ({ projects: [] })),
          fetchRoleUserCounts(),
        ]);

        const rawReqs = reqsData.joinRequests || [];
        const sorted = rawReqs.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const loadedRoles = rolesData.roles || [];
        const loadedProjects = projectsData.projects || [];

        setRequests(sorted);
        setRoles(loadedRoles);
        setRoleCounts(counts);
        setProjects(loadedProjects);

        const defaultRoleId = loadedRoles.some((r) => r.id === 'developer')
          ? 'developer'
          : loadedRoles[0]?.id || 'developer';
        const defaultProjectId = loadedProjects[0]?.id || '';

        // Initialize selections for each request
        const initialSelections: Record<string, { roleId: string; projectId: string; boardId: string }> = {};
        for (const req of sorted) {
          initialSelections[req.id] = {
            roleId: defaultRoleId,
            projectId: defaultProjectId,
            boardId: '',
          };
        }
        setSelections(initialSelections);

        if (defaultProjectId) {
          const boardsData = await apiClient
            .get<{ boards: BoardOption[] }>(`/api/projects/${defaultProjectId}/boards`)
            .catch(() => ({ boards: [] }));
          const boards = boardsData.boards || [];
          setProjectBoards({ [defaultProjectId]: boards });

          if (boards.length > 0) {
            setSelections((prev) => {
              const updated = { ...prev };
              for (const id of Object.keys(updated)) {
                updated[id] = { ...updated[id], boardId: boards[0].id };
              }
              return updated;
            });
          }
        }
      } catch {
        // Ignored
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const handleProjectChange = async (userId: string, newProjectId: string) => {
    setSelections((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        projectId: newProjectId,
        boardId: '',
      },
    }));

    if (newProjectId) {
      if (!projectBoards[newProjectId]) {
        try {
          const data = await apiClient.get<{ boards: BoardOption[] }>(`/api/projects/${newProjectId}/boards`);
          const boards = data.boards || [];
          setProjectBoards((pb) => ({ ...pb, [newProjectId]: boards }));
          if (boards.length > 0) {
            setSelections((prev) => ({
              ...prev,
              [userId]: {
                ...prev[userId],
                boardId: boards[0].id,
              },
            }));
          }
        } catch {
          // Failed
        }
      } else {
        const boards = projectBoards[newProjectId] || [];
        if (boards.length > 0) {
          setSelections((prev) => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              boardId: boards[0].id,
            },
          }));
        }
      }
    }
  };

  const handleRoleChange = (userId: string, newRoleId: string) => {
    setSelections((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        roleId: newRoleId,
      },
    }));
  };

  const handleBoardChange = (userId: string, newBoardId: string) => {
    setSelections((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        boardId: newBoardId,
      },
    }));
  };

  const handleApprove = async (user: PendingJoinRequest) => {
    const userSel = selections[user.id] || {
      roleId: 'developer',
      projectId: projects[0]?.id || '',
      boardId: '',
    };

    setActionInProgress(user.id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload: {
        roleIds: string[];
        projectIds?: string[];
        boardIds?: string[];
      } = {
        roleIds: [userSel.roleId || 'developer'],
      };

      if (userSel.projectId) {
        payload.projectIds = [userSel.projectId];
      }
      if (userSel.boardId) {
        payload.boardIds = [userSel.boardId];
      }

      await apiClient.post(`/api/join-requests/${user.id}/approve`, payload);
      setSuccessMessage(`Approved ${user.email} with role "${userSel.roleId}".`);
      await fetchRequests();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to approve join request.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!userToReject || isRejecting) return;

    setIsRejecting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiClient.post(`/api/join-requests/${userToReject.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      setSuccessMessage(`Rejected request from ${userToReject.email}.`);
      setUserToReject(null);
      setRejectReason('');
      await fetchRequests();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reject join request.');
    } finally {
      setIsRejecting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Join requests"
          description="Review new sign-ups waiting for workspace access"
        />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 border border-border rounded-sm bg-card space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-destructive">
          You do not have permission to view or manage join requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Join requests"
        description="Pending users with verified email, oldest first. Approve access to give them a role and board."
      />

      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-sm border border-destructive/30 bg-destructive/10 text-xs text-destructive">
          <X className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 border border-border rounded-sm bg-card space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No one is waiting"
          description="No one is waiting. New sign-ups appear here after they verify their email."
          className="my-8"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {requests.length}
              </span>{' '}
              {requests.length === 1 ? 'user waiting' : 'users waiting'} (oldest first)
            </span>
          </div>

          <div className="rounded-sm border border-border bg-card divide-y divide-border/60">
            {requests.map((user) => {
              const currentSel = selections[user.id] || {
                roleId: 'developer',
                projectId: projects[0]?.id || '',
                boardId: '',
              };
              const currentBoards =
                (currentSel.projectId && projectBoards[currentSel.projectId]) || [];
              const isProcessing = actionInProgress === user.id;

              return (
                <div
                  key={user.id}
                  className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs"
                >
                  {/* User info */}
                  <div className="space-y-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {user.name || 'Unnamed user'}
                      </span>
                      <Badge variant="outline" className="text-[10px] rounded-sm">
                        Verified
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Joined {formatAppDate(user.createdAt)}
                    </p>
                  </div>

                  {/* Role, Project & Board Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-xl">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`role-${user.id}`}
                        className="text-[11px] font-medium text-foreground"
                      >
                        Role
                      </label>
                      <select
                        id={`role-${user.id}`}
                        value={currentSel.roleId}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isProcessing}
                        className="h-8 rounded-sm border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {formatSortedRoles(roles, roleCounts).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.formattedName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`project-${user.id}`}
                        className="text-[11px] font-medium text-foreground flex items-center gap-1"
                      >
                        <FolderKanban className="size-3 text-muted-foreground" />
                        <span>Project</span>
                      </label>
                      <select
                        id={`project-${user.id}`}
                        value={currentSel.projectId}
                        onChange={(e) => handleProjectChange(user.id, e.target.value)}
                        disabled={isProcessing || projects.length === 0}
                        className="h-8 rounded-sm border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {projects.length === 0 ? (
                          <option value="">No projects</option>
                        ) : (
                          projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.key})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`board-${user.id}`}
                        className="text-[11px] font-medium text-foreground flex items-center gap-1"
                      >
                        <LayoutGrid className="size-3 text-muted-foreground" />
                        <span>Board</span>
                      </label>
                      <select
                        id={`board-${user.id}`}
                        value={currentSel.boardId}
                        onChange={(e) => handleBoardChange(user.id, e.target.value)}
                        disabled={isProcessing || currentBoards.length === 0}
                        className="h-8 rounded-sm border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {currentBoards.length === 0 ? (
                          <option value="">No boards</option>
                        ) : (
                          currentBoards.map((b) => {
                            const curProj = projects.find((p) => p.id === currentSel.projectId);
                            return (
                              <option key={b.id} value={b.id}>
                                {b.name}{curProj ? ` (${curProj.key})` : ''}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 xl:pt-0">
                    <Button
                      id={`approve-btn-${user.id}`}
                      data-email={user.email}
                      size="sm"
                      onClick={() => handleApprove(user)}
                      disabled={isProcessing || !currentSel.roleId || !currentSel.boardId}
                      className="h-8 bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs rounded-sm"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      <span>Approve and give access</span>
                    </Button>
                    <Button
                      id={`reject-btn-${user.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => setUserToReject(user)}
                      disabled={isProcessing}
                      className="h-8 text-destructive hover:bg-destructive/10 gap-1.5 text-xs rounded-sm"
                    >
                      <X className="size-3.5" />
                      <span>Reject request</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reject Request Dialog with optional reason */}
      <Dialog
        open={Boolean(userToReject)}
        onOpenChange={(open) => !open && setUserToReject(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject join request</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Reject registration request for {userToReject?.email}? Their account will be closed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 pt-2">
            <label
              htmlFor="reject-reason-input"
              className="text-xs font-medium text-foreground"
            >
              Reason <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="reject-reason-input"
              placeholder="e.g. Please register using your company domain."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUserToReject(null)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              id="confirm-reject-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isRejecting}
            >
              {isRejecting ? 'Rejecting...' : 'Reject request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
