'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { BRAND } from '@/lib/brand';
import type { BoardColumn } from '@/types/project';

interface RoleOption {
  id: string;
  displayName: string;
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useCurrentUser();

  // Progress kept in URL
  const currentStep = searchParams.get('step') || 'project';
  const paramProjectId = searchParams.get('projectId') || '';
  const paramBoardId = searchParams.get('boardId') || '';

  const setStep = React.useCallback(
    (step: string, pId?: string, bId?: string) => {
      const pid = pId ?? paramProjectId;
      const bid = bId ?? paramBoardId;
      const q = new URLSearchParams();
      q.set('step', step);
      if (pid) q.set('projectId', pid);
      if (bid) q.set('boardId', bid);
      router.push(`/setup?${q.toString()}`);
    },
    [paramProjectId, paramBoardId, router]
  );

  // Available roles for column ownership & invite
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  React.useEffect(() => {
    apiClient
      .get<{ roles: RoleOption[] }>('/api/roles')
      .then((res) => setRoles(res.roles || []))
      .catch(() => {});
  }, []);

  // ================= Step a: Project =================
  const [projectName, setProjectName] = React.useState('');
  const [projectKey, setProjectKey] = React.useState('');
  const [projectKeyEdited, setProjectKeyEdited] = React.useState(false);
  const [isSubmittingProject, setIsSubmittingProject] = React.useState(false);
  const [projectError, setProjectError] = React.useState<string | null>(null);

  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    if (!projectKeyEdited) {
      const gen = val.trim().replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
      if (gen.length >= 2) setProjectKey(gen);
    }
  };

  const handleProjectKeyChange = (val: string) => {
    setProjectKeyEdited(true);
    setProjectKey(val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5));
  };

  const isProjectKeyValid = /^[A-Z]{2,5}$/.test(projectKey);
  const canSubmitProject = projectName.trim().length > 0 && isProjectKeyValid && !isSubmittingProject;

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitProject) return;

    setIsSubmittingProject(true);
    setProjectError(null);
    try {
      const res = await apiClient.post<{ project: any }>('/api/projects', {
        name: projectName.trim(),
        key: projectKey.trim(),
      });
      setStep('board', res.project.id);
    } catch (err: any) {
      setProjectError(err.message || 'Failed to create project.');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // ================= Step b: Board =================
  const [boardName, setBoardName] = React.useState('');
  const [isSubmittingBoard, setIsSubmittingBoard] = React.useState(false);
  const [boardError, setBoardError] = React.useState<string | null>(null);

  const canSubmitBoard = boardName.trim().length > 0 && !isSubmittingBoard;

  const handleBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitBoard || !paramProjectId) return;

    setIsSubmittingBoard(true);
    setBoardError(null);
    try {
      const res = await apiClient.post<{ board: any }>(
        `/api/projects/${paramProjectId}/boards`,
        { name: boardName.trim() }
      );
      setStep('columns', paramProjectId, res.board.id);
    } catch (err: any) {
      setBoardError(err.message || 'Failed to create board.');
    } finally {
      setIsSubmittingBoard(false);
    }
  };

  // ================= Step c: Columns =================
  const [columns, setColumns] = React.useState<
    Array<{ id: string; name: string; position: number; isDone: boolean; ownedByRoleIds: string[] }>
  >([]);
  const [isLoadingColumns, setIsLoadingColumns] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState('');
  const [isSavingColumns, setIsSavingColumns] = React.useState(false);

  // Fetch columns when entering step c
  React.useEffect(() => {
    if (currentStep === 'columns' && paramProjectId && paramBoardId) {
      setIsLoadingColumns(true);
      apiClient
        .get<{ columns: BoardColumn[] }>(
          `/api/projects/${paramProjectId}/boards/${paramBoardId}/columns`
        )
        .then(async (res) => {
          const fetchedCols = res.columns || [];
          // Fetch rules for each column
          const colsWithRules = await Promise.all(
            fetchedCols.map(async (c) => {
              try {
                const rulesRes = await apiClient.get<{ moveRoles?: { id: string }[] }>(
                  `/api/projects/${paramProjectId}/columns/${c.id}/rules`
                );
                return {
                  id: c.id,
                  name: c.name,
                  position: c.position,
                  isDone: c.isDone,
                  ownedByRoleIds: (rulesRes.moveRoles || []).map((r) => r.id),
                };
              } catch {
                return {
                  id: c.id,
                  name: c.name,
                  position: c.position,
                  isDone: c.isDone,
                  ownedByRoleIds: [],
                };
              }
            })
          );
          setColumns(colsWithRules);
        })
        .catch(() => {})
        .finally(() => setIsLoadingColumns(false));
    }
  }, [currentStep, paramProjectId, paramBoardId]);

  // Rename column
  const handleRenameColumn = (index: number, newName: string) => {
    setColumns((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: newName };
      return next;
    });
  };

  // Reorder column (up/down)
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    setColumns((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((c, i) => ({ ...c, position: i }));
    });
  };

  // Add column
  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !paramProjectId || !paramBoardId) return;
    try {
      const res = await apiClient.post<{ column: BoardColumn }>(
        `/api/projects/${paramProjectId}/boards/${paramBoardId}/columns`,
        { name: newColumnName.trim() }
      );
      setColumns((prev) => [
        ...prev,
        {
          id: res.column.id,
          name: res.column.name,
          position: prev.length,
          isDone: false,
          ownedByRoleIds: [],
        },
      ]);
      setNewColumnName('');
    } catch (err: any) {
      alert(err.message || 'Failed to add column.');
    }
  };

  // Delete column
  const handleDeleteColumn = async (colId: string) => {
    if (columns.length <= 1) {
      alert('A board must have at least one column.');
      return;
    }
    try {
      await apiClient.delete(`/api/projects/${paramProjectId}/columns/${colId}`);
      setColumns((prev) => prev.filter((c) => c.id !== colId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete column.');
    }
  };

  // Toggle ownership role for column
  const handleToggleColumnRole = (colIndex: number, roleId: string) => {
    setColumns((prev) => {
      const next = [...prev];
      const current = next[colIndex].ownedByRoleIds;
      if (current.includes(roleId)) {
        next[colIndex] = {
          ...next[colIndex],
          ownedByRoleIds: current.filter((id) => id !== roleId),
        };
      } else {
        next[colIndex] = {
          ...next[colIndex],
          ownedByRoleIds: [...current, roleId],
        };
      }
      return next;
    });
  };

  const handleSetColumnAnyone = (colIndex: number) => {
    setColumns((prev) => {
      const next = [...prev];
      next[colIndex] = { ...next[colIndex], ownedByRoleIds: [] };
      return next;
    });
  };

  // Save all column adjustments & proceed
  const handleColumnsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingColumns || !paramProjectId || !paramBoardId) return;

    setIsSavingColumns(true);
    try {
      // 1. Reorder columns
      await apiClient.patch(
        `/api/projects/${paramProjectId}/boards/${paramBoardId}/columns`,
        {
          columns: columns.map((c, i) => ({ id: c.id, position: i })),
        }
      );

      // 2. Update names & rules
      for (const col of columns) {
        await apiClient.patch(
          `/api/projects/${paramProjectId}/columns/${col.id}`,
          { name: col.name }
        );
        await apiClient.put(
          `/api/projects/${paramProjectId}/columns/${col.id}/rules`,
          {
            moveRoleIds: col.ownedByRoleIds,
          }
        );
      }

      setStep('invite');
    } catch (err: any) {
      alert(err.message || 'Failed to save columns.');
    } finally {
      setIsSavingColumns(false);
    }
  };

  // ================= Step d: Invite =================
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRoleId, setInviteRoleId] = React.useState('developer');
  const [isSendingInvite, setIsSendingInvite] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (roles.length > 0 && !roles.some((r) => r.id === inviteRoleId)) {
      setInviteRoleId(roles[0].id);
    }
  }, [roles, inviteRoleId]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isSendingInvite) return;

    setIsSendingInvite(true);
    setInviteError(null);
    try {
      await apiClient.post('/api/invites', {
        email: inviteEmail.trim(),
        roleIds: [inviteRoleId],
        projectIds: paramProjectId ? [paramProjectId] : [],
        boardIds: paramBoardId ? [paramBoardId] : [],
      });
      setStep('finish');
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleSkipInvite = () => {
    setStep('finish');
  };

  // ================= Step e: Finish =================
  const handleOpenBoard = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rolane_setup_completed', 'true');
    }
    if (paramProjectId && paramBoardId) {
      router.push(`/projects/${paramProjectId}/boards/${paramBoardId}`);
    } else {
      router.push('/projects');
    }
  };

  const stepsList = [
    { key: 'project', label: '1. Project' },
    { key: 'board', label: '2. Board' },
    { key: 'columns', label: '3. Columns' },
    { key: 'invite', label: '4. Invite' },
    { key: 'finish', label: '5. Finish' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-sm bg-brand text-brand-foreground font-semibold text-xs">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight">{BRAND.name}</span>
          <span className="text-xs text-muted-foreground ml-2">Initial setup</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Container */}
      <div className="max-w-xl mx-auto w-full my-auto py-8">
        {/* Step Tracker */}
        <div className="flex items-center justify-between mb-8 pb-3 border-b border-border text-xs">
          {stepsList.map((s) => {
            const isActive = currentStep === s.key;
            return (
              <span
                key={s.key}
                className={`font-medium ${
                  isActive
                    ? 'text-brand font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            );
          })}
        </div>

        {/* STEP A: Name the first project */}
        {currentStep === 'project' && (
          <div className="border border-border rounded-sm bg-card p-6 space-y-6">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Name your first project
              </h1>
              <p className="text-xs text-muted-foreground">
                A project groups boards and team members together.
              </p>
            </div>

            <form onSubmit={handleProjectSubmit} className="space-y-4">
              {projectError && (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {projectError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="setup-project-name" className="text-xs font-medium text-foreground">
                  Project name
                </label>
                <Input
                  id="setup-project-name"
                  placeholder="e.g. Core Platform"
                  value={projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  className="h-9 text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="setup-project-key" className="text-xs font-medium text-foreground">
                    Project key
                  </label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {projectKey.length}/5 capital letters
                  </span>
                </div>
                <Input
                  id="setup-project-key"
                  placeholder="e.g. CP"
                  value={projectKey}
                  onChange={(e) => handleProjectKeyChange(e.target.value)}
                  className="h-9 font-mono text-xs uppercase"
                  maxLength={5}
                  required
                />
                <div className="flex items-center justify-between pt-0.5 text-[11px]">
                  <span className="text-muted-foreground">
                    Task prefix preview:{' '}
                    <span className="font-mono font-medium text-foreground">
                      {projectKey ? `${projectKey}-101` : 'KEY-101'}
                    </span>
                  </span>
                  {projectKey && !isProjectKeyValid && (
                    <span className="text-destructive">2 to 5 letters required</span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  id="setup-continue-project-btn"
                  type="submit"
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5"
                  disabled={!canSubmitProject}
                >
                  <span>Continue to board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP B: Name the board */}
        {currentStep === 'board' && (
          <div className="border border-border rounded-sm bg-card p-6 space-y-6">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Name the board
              </h1>
              <p className="text-xs text-muted-foreground">
                A board holds the workflow columns your team moves work through.
              </p>
            </div>

            <form onSubmit={handleBoardSubmit} className="space-y-4">
              {boardError && (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {boardError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="setup-board-name" className="text-xs font-medium text-foreground">
                  Board name
                </label>
                <Input
                  id="setup-board-name"
                  placeholder="e.g. Development, Sprint 1"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="h-9 text-xs"
                  required
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                Starting columns (To Do, In Progress, Done) will be generated for you to customize in the next step.
              </p>

              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('project')}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </Button>
                <Button
                  id="setup-continue-board-btn"
                  type="submit"
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5"
                  disabled={!canSubmitBoard}
                >
                  <span>Continue to columns</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP C: Set the columns */}
        {currentStep === 'columns' && (
          <div className="border border-border rounded-sm bg-card p-6 space-y-6">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Set the columns
              </h1>
              <p className="text-xs text-muted-foreground">
                Start from the three default columns. Rename, reorder, add, delete, and choose who owns each column.
              </p>
            </div>

            {isLoadingColumns ? (
              <div className="space-y-3 py-4">
                <div className="h-10 bg-muted/40 animate-pulse rounded-sm" />
                <div className="h-10 bg-muted/40 animate-pulse rounded-sm" />
                <div className="h-10 bg-muted/40 animate-pulse rounded-sm" />
              </div>
            ) : (
              <form onSubmit={handleColumnsSubmit} className="space-y-4">
                <div className="space-y-2.5">
                  {columns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="p-3 border border-border rounded-sm bg-background space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        {/* Reorder Buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            aria-label={`Move ${col.name} up`}
                            onClick={() => handleMoveColumn(idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-xs"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${col.name} down`}
                            onClick={() => handleMoveColumn(idx, 'down')}
                            disabled={idx === columns.length - 1}
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-xs"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Column Name Input */}
                        <Input
                          value={col.name}
                          onChange={(e) => handleRenameColumn(idx, e.target.value)}
                          className="h-8 text-xs flex-1"
                          aria-label={`Column name ${idx + 1}`}
                          required
                        />

                        {/* Done indicator */}
                        {col.isDone && (
                          <Badge variant="secondary" className="text-[10px] rounded-sm shrink-0">
                            Done
                          </Badge>
                        )}

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeleteColumn(col.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Delete column"
                          disabled={columns.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Owned By Roles Selection */}
                      <div className="pt-1 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-medium text-foreground">Owned by:</span>
                          <span className="text-muted-foreground">
                            {col.ownedByRoleIds.length === 0
                              ? 'Anyone'
                              : col.ownedByRoleIds
                                  .map((rId) => roles.find((r) => r.id === rId)?.displayName || rId)
                                  .join(', ')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSetColumnAnyone(idx)}
                            className={`px-2 py-0.5 text-[11px] rounded-sm border transition-colors ${
                              col.ownedByRoleIds.length === 0
                                ? 'bg-brand text-brand-foreground border-brand font-medium'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Anyone
                          </button>

                          {roles.map((role) => {
                            const isSelected = col.ownedByRoleIds.includes(role.id);
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => handleToggleColumnRole(idx, role.id)}
                                className={`px-2 py-0.5 text-[11px] rounded-sm border transition-colors ${
                                  isSelected
                                    ? 'bg-brand text-brand-foreground border-brand font-medium'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {role.displayName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new column inline */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="New column name..."
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddColumn}
                    className="gap-1 text-xs shrink-0"
                    disabled={!newColumnName.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add column</span>
                  </Button>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('board')}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    id="setup-continue-columns-btn"
                    type="submit"
                    size="sm"
                    className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5"
                    disabled={isSavingColumns}
                  >
                    <span>Continue to invite</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP D: Invite people */}
        {currentStep === 'invite' && (
          <div className="border border-border rounded-sm bg-card p-6 space-y-6">
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Invite people
              </h1>
              <p className="text-xs text-muted-foreground">
                Choose a role, a project and a board, and send the invite.
              </p>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              {inviteError && (
                <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {inviteError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="setup-invite-email" className="text-xs font-medium text-foreground">
                  Email address
                </label>
                <Input
                  id="setup-invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="setup-invite-role" className="text-xs font-medium text-foreground">
                  Role
                </label>
                <select
                  id="setup-invite-role"
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="w-full h-9 rounded-sm border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-sm border border-border bg-muted/20 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium text-foreground">{projectName || 'Selected project'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Board:</span>
                  <span className="font-medium text-foreground">{boardName || 'Selected board'}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-border">
                <button
                  id="setup-skip-invite-btn"
                  type="button"
                  onClick={handleSkipInvite}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  I will invite people later
                </button>
                <Button
                  id="setup-send-invite-btn"
                  type="submit"
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5"
                  disabled={!inviteEmail.trim() || isSendingInvite}
                >
                  {isSendingInvite ? 'Sending...' : 'Send invite'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP E: Finish */}
        {currentStep === 'finish' && (
          <div className="border border-border rounded-sm bg-card p-6 space-y-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-sm bg-brand/10 text-brand mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                Setup complete
              </h1>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Your project and board are ready. Start tracking role handoffs and task waiting times.
              </p>
            </div>

            <div className="pt-4">
              <Button
                id="setup-open-board-btn"
                size="sm"
                onClick={handleOpenBoard}
                className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 px-6 h-9"
              >
                <span>Open the board</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer */}
      <div className="max-w-2xl mx-auto w-full text-center text-[11px] text-muted-foreground pt-6 border-t border-border/80">
        Rolane — Role-based task board for software engineering teams.
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-sm" />
        </div>
      }
    >
      <SetupContent />
    </React.Suspense>
  );
}
