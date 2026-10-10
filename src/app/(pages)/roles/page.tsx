'use client';

import * as React from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Check,
  Users,
  Info,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
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

interface RoleItem {
  id: string;
  displayName: string;
  permissionKeys: string[];
  userCount?: number;
}

type CatalogGrouped = Record<string, Array<{ permission: string; label: string }>>;

export default function RolesPage() {
  const { can } = useCurrentUser();
  const canManageRoles = can('role.manage');

  const [roles, setRoles] = React.useState<RoleItem[]>([]);
  const [catalog, setCatalog] = React.useState<CatalogGrouped>({});
  const [userCounts, setUserCounts] = React.useState<Record<string, number>>({});
  const [_activeManagersCount, setActiveManagersCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Create role dialog
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createDisplayName, setCreateDisplayName] = React.useState('');
  const [createPermissions, setCreatePermissions] = React.useState<string[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Edit role dialog
  const [editingRole, setEditingRole] = React.useState<RoleItem | null>(null);
  const [editDisplayName, setEditDisplayName] = React.useState('');
  const [editPermissions, setEditPermissions] = React.useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete role dialog
  const [deletingRole, setDeletingRole] = React.useState<RoleItem | null>(null);
  const [reassignToRoleId, setReassignToRoleId] = React.useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [rolesRes, catalogRes, usersRes] = await Promise.all([
        apiClient.get<{ roles: RoleItem[] }>('/api/roles'),
        apiClient.get<{ permissions: CatalogGrouped }>('/api/permissions'),
        apiClient.get<{ users: any[] }>('/api/users').catch(() => ({ users: [] })),
      ]);

      setRoles(rolesRes.roles || []);
      setCatalog(catalogRes.permissions || {});

      // Calculate user counts per role
      const usersList = usersRes.users || [];
      const counts: Record<string, number> = {};
      let managers = 0;

      await Promise.all(
        usersList.map(async (u) => {
          try {
            const prof = await apiClient.get<{ profile: any }>(`/api/users/${u.id}/profile`);
            const userRoles = prof.profile?.roles || [];
            const userPerms = prof.profile?.permissions || [];
            if (userPerms.includes('role.manage')) {
              managers++;
            }
            for (const r of userRoles) {
              counts[r.id] = (counts[r.id] || 0) + 1;
            }
          } catch {
            // Ignore
          }
        })
      );

      setUserCounts(counts);
      setActiveManagersCount(managers);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load roles.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setCreateDisplayName('');
    setCreatePermissions([]);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleToggleCreatePerm = (perm: string) => {
    setCreatePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const canSubmitCreate = createDisplayName.trim().length > 0 && !isSubmittingCreate;

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitCreate) return;

    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      await apiClient.post('/api/roles', {
        displayName: createDisplayName.trim(),
        permissionKeys: createPermissions,
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create role.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (role: RoleItem) => {
    setEditingRole(role);
    setEditDisplayName(role.displayName);
    setEditPermissions([...role.permissionKeys]);
    setEditError(null);
  };

  const handleToggleEditPerm = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // Check if edit will remove permissions from a role with active users
  const isRemovingPermissions = React.useMemo(() => {
    if (!editingRole) return false;
    const removed = editingRole.permissionKeys.filter((p) => !editPermissions.includes(p));
    return removed.length > 0;
  }, [editingRole, editPermissions]);

  const editingRoleUserCount = editingRole ? userCounts[editingRole.id] ?? 0 : 0;

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editDisplayName.trim() || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await apiClient.patch(`/api/roles/${editingRole.id}`, {
        displayName: editDisplayName.trim(),
        permissionKeys: editPermissions,
      });
      setEditingRole(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update role.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (role: RoleItem) => {
    setDeletingRole(role);
    const otherRoles = roles.filter((r) => r.id !== role.id);
    setReassignToRoleId(otherRoles[0]?.id || '');
    setDeleteError(null);
  };

  const deletingRoleUserCount = deletingRole ? userCounts[deletingRole.id] ?? 0 : 0;

  const handleDeleteRole = async () => {
    if (!deletingRole || isSubmittingDelete) return;

    setIsSubmittingDelete(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/roles/${deletingRole.id}`, {
        body: JSON.stringify({
          reassignToRoleId: deletingRoleUserCount > 0 ? reassignToRoleId : undefined,
        }),
      });
      setDeletingRole(null);
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete role.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (!canManageRoles) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-destructive">
          You do not have permission to manage roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles and permissions"
        description="Manage workspace roles, column authority, and permission catalogs"
        actions={
          <Button
            id="create-role-btn"
            size="sm"
            onClick={handleOpenCreate}
            className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90 rounded-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create role</span>
          </Button>
        }
      />

      {/* Role Manager Guard Rule Notice */}
      <div className="flex items-center gap-2.5 p-3 rounded-sm border border-border bg-muted/30 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          There must always be one active person who can manage roles.
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 border border-border rounded-sm bg-card space-y-3"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-8 text-center text-sm text-destructive">{errorMessage}</div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles configured"
          description="Create roles to control who can view and move work in each column."
          action={{
            label: 'Create role',
            onClick: handleOpenCreate,
          }}
          className="my-8"
        />
      ) : (
        <div className="space-y-3">
          {roles.map((role) => {
            const count = userCounts[role.id] ?? 0;
            const hasManage = role.permissionKeys.includes('role.manage');

            return (
              <div
                key={role.id}
                className="p-5 border border-border rounded-sm bg-card space-y-4 hover:border-border/90 transition-colors"
              >
                {/* Header: Name, Count, Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {role.displayName}
                      </h2>
                      {hasManage && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-brand border-brand/30 bg-brand/5 rounded-sm"
                        >
                          Role manager
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="tabular-nums font-medium text-foreground">
                        {count}
                      </span>
                      <span>{count === 1 ? 'person' : 'people'} with this role</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(role)}
                      className="gap-1.5 text-xs h-8 rounded-sm"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-role-id={role.id}
                      data-action="delete-role"
                      onClick={() => handleOpenDelete(role)}
                      className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive rounded-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>

                {/* Grouped permissions display */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Permissions ({role.permissionKeys.length})
                  </div>

                  {role.permissionKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No permissions granted.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(catalog).map(([groupName, groupPerms]) => {
                        const grantedInGroup = groupPerms.filter((p) =>
                          role.permissionKeys.includes(p.permission)
                        );
                        if (grantedInGroup.length === 0) return null;

                        return (
                          <div
                            key={groupName}
                            className="p-3 rounded-sm border border-border/60 bg-muted/20 space-y-1.5"
                          >
                            <span className="text-[11px] font-semibold text-foreground tracking-tight block">
                              {groupName}
                            </span>
                            <div className="space-y-1">
                              {grantedInGroup.map((p) => (
                                <div
                                  key={p.permission}
                                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                >
                                  <Check className="h-3 w-3 text-brand shrink-0" />
                                  <span className="truncate">{p.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b border-border/80">
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>
              Name the role and select the permissions granted to members with this role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRole} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {createError && (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="role-display-name"
                  className="text-xs font-medium text-foreground"
                >
                  Display name
                </label>
                <Input
                  id="role-display-name"
                  placeholder="e.g. Quality Assurance"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  className="h-9 text-xs"
                  required
                  autoFocus
                />
              </div>

              {/* Grouped permissions checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Permissions
                  </label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {createPermissions.length} selected
                  </span>
                </div>

                <div className="space-y-3">
                  {Object.entries(catalog).map(([groupName, groupPerms]) => (
                    <div
                      key={groupName}
                      className="border border-border/70 rounded-sm p-3 bg-muted/10 space-y-2"
                    >
                      <span className="text-xs font-semibold text-foreground block">
                        {groupName}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupPerms.map((p) => {
                          const isChecked = createPermissions.includes(p.permission);
                          return (
                            <label
                              key={p.permission}
                              className="flex items-center gap-2 text-xs cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCreatePerm(p.permission)}
                                className="size-3.5 rounded-sm border-border text-brand focus:ring-ring"
                              />
                              <span className="text-muted-foreground">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border bg-card">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Cancel
              </Button>
              <Button
                id="submit-create-role-btn"
                type="submit"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={!canSubmitCreate}
              >
                {isSubmittingCreate ? 'Creating...' : 'Create role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog
        open={Boolean(editingRole)}
        onOpenChange={(open) => !open && setEditingRole(null)}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b border-border/80">
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>
              Rename the role and update permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditRole} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {editError && (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {editError}
                </div>
              )}

              {/* Warning when removing permissions */}
              {isRemovingPermissions && editingRoleUserCount > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-sm border border-amber-500/40 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Access reduction warning</span>
                    Removing permissions will reduce access for{' '}
                    <span className="tabular-nums font-semibold">
                      {editingRoleUserCount}
                    </span>{' '}
                    {editingRoleUserCount === 1 ? 'person' : 'people'} currently assigned this role.
                  </div>
                </div>
              )}

              {/* Guard warning if role includes role.manage */}
              {editingRole?.permissionKeys.includes('role.manage') && (
                <div className="p-2.5 rounded-sm border border-border bg-muted/30 text-[11px] text-muted-foreground">
                  There must always be one active person who can manage roles.
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="edit-role-display-name"
                  className="text-xs font-medium text-foreground"
                >
                  Display name
                </label>
                <Input
                  id="edit-role-display-name"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              {/* Grouped permissions checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Permissions
                  </label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {editPermissions.length} selected
                  </span>
                </div>

                <div className="space-y-3">
                  {Object.entries(catalog).map(([groupName, groupPerms]) => (
                    <div
                      key={groupName}
                      className="border border-border/70 rounded-sm p-3 bg-muted/10 space-y-2"
                    >
                      <span className="text-xs font-semibold text-foreground block">
                        {groupName}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupPerms.map((p) => {
                          const isChecked = editPermissions.includes(p.permission);
                          return (
                            <label
                              key={p.permission}
                              className="flex items-center gap-2 text-xs cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleEditPerm(p.permission)}
                                className="size-3.5 rounded-sm border-border text-brand focus:ring-ring"
                              />
                              <span className="text-muted-foreground">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border bg-card">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingRole(null)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </Button>
              <Button
                id="submit-edit-role-btn"
                type="submit"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={!editDisplayName.trim() || isSubmittingEdit}
              >
                {isSubmittingEdit ? 'Saving...' : 'Save role changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog
        open={Boolean(deletingRole)}
        onOpenChange={(open) => !open && setDeletingRole(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Delete &quot;{deletingRole?.displayName}&quot;?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {deleteError}
            </div>
          )}

          {deletingRoleUserCount > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-sm border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold tabular-nums">
                  {deletingRoleUserCount}
                </span>{' '}
                {deletingRoleUserCount === 1 ? 'person has' : 'people have'} this role. Choose a role to move them to before deleting.
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reassign-role-select"
                  className="text-xs font-medium text-foreground"
                >
                  Move people to:
                </label>
                <select
                  id="reassign-role-select"
                  value={reassignToRoleId}
                  onChange={(e) => setReassignToRoleId(e.target.value)}
                  className="w-full h-9 rounded-sm border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {roles
                    .filter((r) => r.id !== deletingRole?.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayName}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-2">
              No users currently have this role. It can be safely deleted.
            </p>
          )}

          {deletingRole?.permissionKeys.includes('role.manage') && (
            <p className="text-[11px] text-muted-foreground pt-2">
              There must always be one active person who can manage roles.
            </p>
          )}

          <DialogFooter className="pt-4 border-t border-border mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingRole(null)}
              disabled={isSubmittingDelete}
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-role-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteRole}
              disabled={isSubmittingDelete || (deletingRoleUserCount > 0 && !reassignToRoleId)}
            >
              {isSubmittingDelete ? 'Deleting...' : 'Delete role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
