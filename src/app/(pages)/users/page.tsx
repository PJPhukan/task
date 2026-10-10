'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Edit2,
  AlertTriangle,
  Search,
  ExternalLink,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

interface UserListItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: Array<{ id: string; displayName: string }>;
  projectsCount?: number;
  boardsCount?: number;
}

interface RoleOption {
  id: string;
  displayName: string;
}

export default function UsersPage() {
  const { can } = useCurrentUser();
  const canManageUsers = can('user.manage');

  const [users, setUsers] = React.useState<UserListItem[]>([]);
  const [allRoles, setAllRoles] = React.useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Edit user state
  const [editingUser, setEditingUser] = React.useState<UserListItem | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [editRoleIds, setEditRoleIds] = React.useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiClient.get<{ users: any[] }>('/api/users'),
        apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
      ]);

      setAllRoles(rolesRes.roles || []);
      const rawUsers = usersRes.users || [];

      // Enrich users with profiles (roles, active state)
      const enriched: UserListItem[] = await Promise.all(
        rawUsers.map(async (u) => {
          try {
            const pRes = await apiClient.get<{ profile: any }>(`/api/users/${u.id}/profile`);
            const prof = pRes.profile;
            return {
              id: u.id,
              name: prof.name || u.name,
              email: prof.email || u.email,
              isActive: prof.isActive !== false,
              roles: prof.roles || [],
              projectsCount: prof.projects?.length || 0,
              boardsCount: prof.boards?.length || 0,
            };
          } catch {
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              isActive: true,
              roles: [],
              projectsCount: 0,
              boardsCount: 0,
            };
          }
        })
      );

      setUsers(enriched);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load users list.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Edit User dialog
  const handleOpenEdit = (user: UserListItem) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditIsActive(user.isActive);
    setEditRoleIds(user.roles.map((r) => r.id));
    setEditError(null);
  };

  const handleToggleRole = (roleId: string) => {
    setEditRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName.trim() || !editEmail.trim() || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      // 1. Update name, email, isActive
      await apiClient.patch(`/api/users/${editingUser.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        isActive: editIsActive,
      });

      // 2. Update roles
      await apiClient.put(`/api/users/${editingUser.id}/roles`, {
        roleIds: editRoleIds,
      });

      setEditingUser(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.roles.some((r) => r.displayName.toLowerCase().includes(q))
    );
  });

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="View team members, account status, and role assignments"
      />

      {/* Filter / Search */}
      <div className="flex items-center justify-between gap-3 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="search-users-input"
            type="search"
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/40 border-border/70 rounded-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 border border-border rounded-sm bg-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-8 text-center text-sm text-destructive">{errorMessage}</div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="No users match the search query."
          action={{
            label: 'Clear search',
            onClick: () => setSearchQuery(''),
          }}
          className="my-8"
        />
      ) : (
        <div className="border border-border rounded-sm overflow-hidden bg-card">
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">User</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-4">Roles</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-border">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4 p-4 hover:bg-muted/20 transition-colors"
              >
                {/* User avatar and name/email */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <Avatar size="sm" className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-brand/10 text-brand">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      href={`/users/${user.id}`}
                      className="text-xs font-semibold text-foreground hover:text-brand transition-colors truncate block"
                    >
                      {user.name}
                    </Link>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">
                  {user.isActive ? (
                    <Badge
                      variant="outline"
                      className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 rounded-sm"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-normal text-muted-foreground bg-muted/70 rounded-sm"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>

                {/* Roles */}
                <div className="col-span-4 flex flex-wrap gap-1">
                  {user.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No roles</span>
                  ) : (
                    user.roles.map((r) => (
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

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <Link href={`/users/${user.id}`}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-foreground"
                      title="View profile"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>

                  {canManageUsers && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(user)}
                      className="gap-1 text-xs h-7 rounded-sm"
                    >
                      <Edit2 className="h-3 w-3 text-muted-foreground" />
                      <span>Edit</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update user profile, status, and assigned roles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4 pt-2">
            {editError && (
              <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="edit-user-name"
                className="text-xs font-medium text-foreground"
              >
                Name
              </label>
              <Input
                id="edit-user-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-user-email"
                className="text-xs font-medium text-foreground"
              >
                Email address
              </label>
              <Input
                id="edit-user-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Active Toggle & Warning */}
            <div className="p-3 rounded-sm border border-border bg-muted/20 space-y-2">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs font-medium text-foreground">
                  Active account
                </span>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="size-4 rounded-sm border-border text-brand focus:ring-ring"
                />
              </label>

              {!editIsActive && (
                <div className="flex items-start gap-2 pt-1 border-t border-border/60 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Deactivating signs them out at once and ends all active sessions.
                  </span>
                </div>
              )}
            </div>

            {/* Roles checklist */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Assigned roles
              </label>
              <div className="space-y-1.5 p-3 rounded-sm border border-border bg-muted/10 max-h-44 overflow-y-auto">
                {allRoles.map((r) => {
                  const isChecked = editRoleIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-2.5 text-xs cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRole(r.id)}
                        className="size-3.5 rounded-sm border-border text-brand focus:ring-ring"
                      />
                      <span className="text-foreground">{r.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(null)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </Button>
              <Button
                id="submit-edit-user-btn"
                type="submit"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={!editName.trim() || !editEmail.trim() || isSubmittingEdit}
              >
                {isSubmittingEdit ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
