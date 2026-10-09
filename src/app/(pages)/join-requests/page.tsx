'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Users, Check, X, Loader2, FolderKanban, LayoutGrid, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
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

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiClient.get<{ joinRequests: PendingJoinRequest[] }>('/api/join-requests');
      setRequests(data.joinRequests || []);
    } catch {
      // Failed to list
    }
  }, []);

  const loadBoardsForProject = useCallback(async (projectId: string) => {
    if (!projectId || projectBoards[projectId]) return;
    try {
      const data = await apiClient.get<{ boards: BoardOption[] }>(`/api/projects/${projectId}/boards`);
      setProjectBoards((prev) => ({
        ...prev,
        [projectId]: data.boards || [],
      }));
    } catch {
      // Failed
    }
  }, [projectBoards]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [reqsData, rolesData, projectsData] = await Promise.all([
          apiClient.get<{ joinRequests: PendingJoinRequest[] }>('/api/join-requests'),
          apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
          apiClient.get<{ projects: ProjectOption[] }>('/api/projects').catch(() => ({ projects: [] })),
        ]);

        const reqs = reqsData.joinRequests || [];
        const loadedRoles = rolesData.roles || [];
        const loadedProjects = projectsData.projects || [];

        setRequests(reqs);
        setRoles(loadedRoles);
        setProjects(loadedProjects);

        const defaultRoleId = loadedRoles.some((r) => r.id === 'developer')
          ? 'developer'
          : loadedRoles[0]?.id || 'developer';
        const defaultProjectId = loadedProjects[0]?.id || '';

        // Initialize selections for each request
        const initialSelections: Record<string, { roleId: string; projectId: string; boardId: string }> = {};
        for (const req of reqs) {
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

  const handleReject = async (user: PendingJoinRequest) => {
    setActionInProgress(user.id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiClient.post(`/api/join-requests/${user.id}/reject`, {
        reason: 'Registration request declined by administrator',
      });
      setSuccessMessage(`Rejected request from ${user.email}.`);
      await fetchRequests();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reject join request.');
    } finally {
      setActionInProgress(null);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Join Requests" description="Self-registered user approvals" />
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading join requests...
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="space-y-6">
        <PageHeader title="Join Requests" description="Self-registered user approvals" />
        <div className="rounded-sm border border-danger/30 bg-danger/5 p-6 text-center">
          <h2 className="text-sm font-semibold text-foreground">Access denied</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You do not have permission to review workspace join requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Join Requests"
        description="Review self-registered users, assign their starting role, and grant workspace access"
      />

      {successMessage && (
        <div
          role="status"
          className="rounded-sm border border-success/40 bg-success/10 px-3 py-2 text-xs text-success flex items-center gap-2"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending user requests ({requests.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Loading join requests...
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No pending join requests"
            description="All verified self-registered users have already been reviewed and approved or rejected."
            nextActionText="New user registrations requiring approval will appear here automatically."
            className="my-4"
          />
        ) : (
          <div className="rounded-sm border border-border bg-card divide-y divide-border/60">
            {requests.map((user) => {
              const currentSel = selections[user.id] || {
                roleId: 'developer',
                projectId: projects[0]?.id || '',
                boardId: '',
              };
              const currentBoards = (currentSel.projectId && projectBoards[currentSel.projectId]) || [];
              const isProcessing = actionInProgress === user.id;

              return (
                <div
                  key={user.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                >
                  {/* User info */}
                  <div className="space-y-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {user.name || 'Unnamed user'}
                      </span>
                      <Badge variant="outline" className="text-[10px] text-brand border-brand/30 bg-brand/5">
                        Verified
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Requested on {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Role, Project & Board Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-xl">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`role-${user.id}`} className="text-[11px] font-medium text-foreground">
                        Assigned role
                      </label>
                      <select
                        id={`role-${user.id}`}
                        value={currentSel.roleId}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isProcessing}
                        className="h-8 rounded-sm border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={`project-${user.id}`} className="text-[11px] font-medium text-foreground flex items-center gap-1">
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
                              {p.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={`board-${user.id}`} className="text-[11px] font-medium text-foreground flex items-center gap-1">
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
                          currentBoards.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    <Button
                      id={`approve-btn-${user.id}`}
                      data-email={user.email}
                      size="sm"
                      onClick={() => handleApprove(user)}
                      disabled={isProcessing}
                      className="h-8 bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 text-xs"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      <span>Approve</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(user)}
                      disabled={isProcessing}
                      className="h-8 text-danger hover:text-danger hover:bg-danger/10 gap-1.5 text-xs"
                    >
                      <X className="size-3.5" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
