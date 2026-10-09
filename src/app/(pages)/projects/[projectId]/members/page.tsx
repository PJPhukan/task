'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Trash2,
  Check,
  Shield,
  LayoutGrid,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Project, Board } from '@/types/project';

interface ProjectMembersPageProps {
  params: Promise<{ projectId: string }>;
}

interface MemberDetail {
  userId: string;
  name: string;
  email: string;
  roles: Array<{ id: string; displayName: string }>;
  accessibleBoardNames: string[];
  ownedColumnNames: string[];
}

export default function ProjectMembersPage(props: ProjectMembersPageProps) {
  const router = useRouter();
  const { projectId } = React.use(props.params);
  const { can } = useCurrentUser();
  const canManageMembers = can('member.manage');

  const [project, setProject] = React.useState<Project | null>(null);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [members, setMembers] = React.useState<MemberDetail[]>([]);
  const [allUsers, setAllUsers] = React.useState<Array<{ id: string; name: string; email: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Add Member Dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [selectedBoardIds, setSelectedBoardIds] = React.useState<string[]>([]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  // Remove Member Dialog state
  const [memberToRemove, setMemberToRemove] = React.useState<MemberDetail | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const fetchMembersData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [projRes, boardsRes, membersRes, usersRes] = await Promise.all([
        apiClient.get<{ project: Project }>(`/api/projects/${projectId}`),
        apiClient.get<{ boards: Board[] }>(`/api/projects/${projectId}/boards`),
        apiClient.get<{ members: any[] }>(`/api/projects/${projectId}/members`),
        apiClient.get<{ users: any[] }>('/api/users').catch(() => ({ users: [] })),
      ]);

      setProject(projRes.project);
      const loadedBoards = boardsRes.boards || [];
      setBoards(loadedBoards);
      setAllUsers(usersRes.users || []);

      // Fetch columns rules for all boards to map column owners
      const colOwnersByRole: Record<string, string[]> = {}; // roleId -> column names
      for (const b of loadedBoards) {
        for (const col of (b as any).columns || []) {
          try {
            const rulesRes = await apiClient.get<any>(
              `/api/projects/${projectId}/columns/${col.id}/rules`
            );
            for (const r of rulesRes.moveRoles || []) {
              if (!colOwnersByRole[r.id]) colOwnersByRole[r.id] = [];
              if (!colOwnersByRole[r.id].includes(col.name)) {
                colOwnersByRole[r.id].push(col.name);
              }
            }
          } catch {
            // Ignore
          }
        }
      }

      // Enrich each member with profile
      const rawMembers = membersRes.members || [];
      const enriched: MemberDetail[] = await Promise.all(
        rawMembers.map(async (m: any) => {
          const u = m.user;
          try {
            const profRes = await apiClient.get<{ profile: any }>(
              `/api/users/${u.id}/profile`
            );
            const prof = profRes.profile;
            const roles = prof.roles || [];
            const roleIds = roles.map((r: any) => r.id);

            // Columns owned by this user's roles
            const ownedCols: string[] = [];
            for (const rId of roleIds) {
              if (colOwnersByRole[rId]) {
                for (const cName of colOwnersByRole[rId]) {
                  if (!ownedCols.includes(cName)) ownedCols.push(cName);
                }
              }
            }

            // Boards this user can open in this project
            const userProjBoards = (prof.boards || [])
              .filter((b: any) => b.projectId === projectId)
              .map((b: any) => b.name);

            return {
              userId: u.id,
              name: u.name,
              email: u.email,
              roles,
              accessibleBoardNames: userProjBoards.length > 0 ? userProjBoards : loadedBoards.map((b) => b.name),
              ownedColumnNames: ownedCols,
            };
          } catch {
            return {
              userId: u.id,
              name: u.name,
              email: u.email,
              roles: [],
              accessibleBoardNames: loadedBoards.map((b) => b.name),
              ownedColumnNames: [],
            };
          }
        })
      );

      setMembers(enriched);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load project members.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchMembersData();
  }, [fetchMembersData]);

  // Handle Add Member
  const handleOpenAdd = () => {
    const existingIds = new Set(members.map((m) => m.userId));
    const available = allUsers.filter((u) => !existingIds.has(u.id));
    if (available.length > 0) {
      setSelectedUserId(available[0].id);
    } else {
      setSelectedUserId('');
    }
    // Select all boards by default so validation passes readily
    setSelectedBoardIds(boards.map((b) => b.id));
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleToggleBoardSelect = (bId: string) => {
    setSelectedBoardIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  const canSubmitAdd = Boolean(selectedUserId) && selectedBoardIds.length > 0 && !isAdding;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitAdd) return;

    setIsAdding(true);
    setAddError(null);
    try {
      await apiClient.post(`/api/projects/${projectId}/members`, {
        userId: selectedUserId,
        boardIds: selectedBoardIds,
      });

      setIsAddOpen(false);
      fetchMembersData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add member to project.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Remove Member
  const handleConfirmRemove = async () => {
    if (!memberToRemove || isRemoving) return;

    setIsRemoving(true);
    try {
      await apiClient.delete(
        `/api/projects/${projectId}/members/${memberToRemove.userId}`
      );
      setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
      setMemberToRemove(null);
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    } finally {
      setIsRemoving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const existingMemberIds = new Set(members.map((m) => m.userId));
  const availableUsersToAdd = allUsers.filter((u) => !existingMemberIds.has(u.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project members"
        description={`Team members with access to ${project?.name || 'Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name || 'Project', href: `/projects/${projectId}` },
          { label: 'Members' },
        ]}
        actions={
          canManageMembers ? (
            <Button
              id="add-member-btn"
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90 rounded-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add member</span>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 border border-border rounded-sm bg-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-8 text-center text-sm text-destructive">{errorMessage}</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members in project"
          description="Members can view boards and move work according to their assigned roles."
          nextActionText={
            canManageMembers
              ? 'Add an existing team member to give them access to this project.'
              : 'Ask a project administrator to add members.'
          }
          action={
            canManageMembers
              ? {
                  label: 'Add member',
                  onClick: handleOpenAdd,
                }
              : undefined
          }
          className="my-8"
        />
      ) : (
        <div className="border border-border rounded-sm overflow-hidden bg-card">
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Member</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-3">Boards</div>
            <div className="col-span-2">Column ownership</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4 p-4 hover:bg-muted/20 transition-colors"
              >
                {/* Avatar and Name */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <Avatar size="sm" className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-brand/10 text-brand">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      href={`/users/${member.userId}`}
                      className="text-xs font-semibold text-foreground hover:text-brand transition-colors truncate block"
                    >
                      {member.name}
                    </Link>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {member.email}
                    </span>
                  </div>
                </div>

                {/* System Roles */}
                <div className="col-span-2 flex flex-wrap gap-1">
                  {member.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Member</span>
                  ) : (
                    member.roles.map((r) => (
                      <Badge
                        key={r.id}
                        variant="secondary"
                        className="text-[10px] font-medium rounded-sm px-1.5 py-0"
                      >
                        {r.displayName}
                      </Badge>
                    ))
                  )}
                </div>

                {/* Accessible Boards */}
                <div className="col-span-3 text-xs text-muted-foreground">
                  {member.accessibleBoardNames.length === 0 ? (
                    <span>All open boards</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {member.accessibleBoardNames.map((bName, idx) => (
                        <span key={idx} className="text-foreground font-medium">
                          {bName}
                          {idx < member.accessibleBoardNames.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column Ownership in this project */}
                <div className="col-span-2 text-xs">
                  {member.ownedColumnNames.length > 0 ? (
                    <div className="text-[11px] font-medium text-brand">
                      Owns: {member.ownedColumnNames.join(', ')}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  {canManageMembers && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setMemberToRemove(member)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add member to project</DialogTitle>
            <DialogDescription>
              Choose an existing user and the boards they can open. A new member must get at least one board.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="space-y-4 pt-2">
            {addError && (
              <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {addError}
              </div>
            )}

            {availableUsersToAdd.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                All existing active users are already members of this project.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="user-select"
                    className="text-xs font-medium text-foreground"
                  >
                    User
                  </label>
                  <select
                    id="user-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-9 rounded-sm border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    required
                  >
                    {availableUsersToAdd.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      Boards they can open
                    </label>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {selectedBoardIds.length} of {boards.length} selected
                    </span>
                  </div>

                  {boards.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No boards in this project yet. Create a board first.
                    </p>
                  ) : (
                    <div className="space-y-1.5 p-3 rounded-sm border border-border bg-muted/20">
                      {boards.map((b) => {
                        const isChecked = selectedBoardIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className="flex items-center gap-2.5 text-xs cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleBoardSelect(b.id)}
                              className="size-3.5 rounded-sm border-border text-brand focus:ring-ring"
                            />
                            <span className="text-foreground font-medium">{b.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {selectedBoardIds.length === 0 && (
                    <p className="text-[11px] text-destructive">
                      A new member must get at least one board.
                    </p>
                  )}
                </div>
              </>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button
                id="submit-add-member-btn"
                type="submit"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={!canSubmitAdd}
              >
                {isAdding ? 'Adding...' : 'Add member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Remove {memberToRemove?.name} from {project?.name}? They will lose access to all boards in this project.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              id="confirm-remove-member-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
