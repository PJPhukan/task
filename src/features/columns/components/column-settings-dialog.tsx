'use client';

import * as React from 'react';
import {
  Columns3,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  Eye,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { BoardColumn } from '@/types/project';

interface RoleOption {
  id: string;
  displayName: string;
}

interface ColumnSettingsDialogProps {
  projectId: string;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsUpdated?: () => void;
}

interface ColumnItem {
  id: string;
  name: string;
  color?: string | null;
  position: number;
  isDone: boolean;
  timeLimitHours?: number | null;
  viewRoleIds: string[];
  moveRoleIds: string[];
  isDirty?: boolean;
}

const PRESET_COLORS = [
  { name: 'Slate', value: '#5E6C79' },
  { name: 'Teal', value: '#0E5652' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Steel', value: '#2D728F' },
  { name: 'Orange', value: '#C25E12' },
  { name: 'Red', value: '#B82828' },
  { name: 'Green', value: '#1A7442' },
  { name: 'Purple', value: '#7C3AED' },
];

export function ColumnSettingsDialog({
  projectId,
  boardId,
  open,
  onOpenChange,
  onColumnsUpdated,
}: ColumnSettingsDialogProps) {
  const [columns, setColumns] = React.useState<ColumnItem[]>([]);
  const [roles, setRoles] = React.useState<RoleOption[]>([]);
  const [selectedColumnId, setSelectedColumnId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // New column
  const [newColName, setNewColName] = React.useState('');
  const [isAddingCol, setIsAddingCol] = React.useState(false);

  // Delete column with tasks state
  const [deletingColumn, setDeletingColumn] = React.useState<ColumnItem | null>(null);
  const [targetColumnId, setTargetColumnId] = React.useState<string>('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);

  // Fetch initial roles & columns with rules
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [rolesRes, colsRes] = await Promise.all([
        apiClient.get<{ roles: RoleOption[] }>('/api/roles'),
        apiClient.get<{ columns: BoardColumn[] }>(
          `/api/projects/${projectId}/boards/${boardId}/columns`
        ),
      ]);

      const loadedRoles = rolesRes.roles || [];
      setRoles(loadedRoles);

      const rawCols = colsRes.columns || [];
      const enrichedCols: ColumnItem[] = await Promise.all(
        rawCols.map(async (c) => {
          try {
            const rulesRes = await apiClient.get<{
              viewRoles?: { id: string }[];
              moveRoles?: { id: string }[];
            }>(`/api/projects/${projectId}/columns/${c.id}/rules`);

            return {
              id: c.id,
              name: c.name,
              color: c.color,
              position: c.position,
              isDone: c.isDone,
              timeLimitHours: c.timeLimitHours,
              viewRoleIds: (rulesRes.viewRoles || []).map((r) => r.id),
              moveRoleIds: (rulesRes.moveRoles || []).map((r) => r.id),
            };
          } catch {
            return {
              id: c.id,
              name: c.name,
              color: c.color,
              position: c.position,
              isDone: c.isDone,
              timeLimitHours: c.timeLimitHours,
              viewRoleIds: [],
              moveRoleIds: [],
            };
          }
        })
      );

      enrichedCols.sort((a, b) => a.position - b.position);
      setColumns(enrichedCols);
      if (enrichedCols.length > 0 && !selectedColumnId) {
        setSelectedColumnId(enrichedCols[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load columns.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, boardId, selectedColumnId]);

  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const selectedCol = columns.find((c) => c.id === selectedColumnId) || columns[0] || null;

  // Reorder column
  const handleMoveColumn = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) return;

    const next = [...columns];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    const reordered = next.map((c, i) => ({ ...c, position: i }));
    setColumns(reordered);

    try {
      await apiClient.patch(
        `/api/projects/${projectId}/boards/${boardId}/columns`,
        {
          columns: reordered.map((c) => ({ id: c.id, position: c.position })),
        }
      );
      if (onColumnsUpdated) onColumnsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to reorder columns.');
      loadData();
    }
  };

  // Add column
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || isAddingCol) return;

    setIsAddingCol(true);
    try {
      const res = await apiClient.post<{ column: BoardColumn }>(
        `/api/projects/${projectId}/boards/${boardId}/columns`,
        { name: newColName.trim() }
      );
      const newCol: ColumnItem = {
        id: res.column.id,
        name: res.column.name,
        color: res.column.color,
        position: columns.length,
        isDone: false,
        timeLimitHours: null,
        viewRoleIds: [],
        moveRoleIds: [],
      };
      setColumns((prev) => [...prev, newCol]);
      setSelectedColumnId(newCol.id);
      setNewColName('');
      if (onColumnsUpdated) onColumnsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to create column.');
    } finally {
      setIsAddingCol(false);
    }
  };

  // Update selected column details
  const updateSelectedCol = (updates: Partial<ColumnItem>) => {
    if (!selectedCol) return;
    setColumns((prev) =>
      prev.map((c) => (c.id === selectedCol.id ? { ...c, ...updates, isDirty: true } : c))
    );
  };

  // Save changes to current column
  const handleSaveCurrentCol = async () => {
    if (!selectedCol || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      // 1. Update basic info (name, color, isDone, timeLimitHours)
      await apiClient.patch(
        `/api/projects/${projectId}/columns/${selectedCol.id}`,
        {
          name: selectedCol.name.trim(),
          color: selectedCol.color,
          isDone: selectedCol.isDone,
          timeLimitHours: selectedCol.isDone ? null : selectedCol.timeLimitHours,
        }
      );

      // 2. Update role rules
      await apiClient.put(
        `/api/projects/${projectId}/columns/${selectedCol.id}/rules`,
        {
          viewRoleIds: selectedCol.viewRoleIds,
          moveRoleIds: selectedCol.moveRoleIds,
        }
      );

      setColumns((prev) =>
        prev.map((c) => (c.id === selectedCol.id ? { ...c, isDirty: false } : c))
      );
      if (onColumnsUpdated) onColumnsUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save column settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Initiate Delete
  const handlePromptDelete = (col: ColumnItem) => {
    if (columns.length <= 1) {
      alert('A board must have at least one column.');
      return;
    }
    const otherCols = columns.filter((c) => c.id !== col.id);
    setTargetColumnId(otherCols[0]?.id || '');
    setDeleteErrorMessage(null);
    setDeletingColumn(col);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingColumn || isDeleting) return;

    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      await apiClient.delete(
        `/api/projects/${projectId}/columns/${deletingColumn.id}`,
        {
          body: JSON.stringify({
            targetColumnId: targetColumnId || undefined,
          }),
        }
      );

      const remaining = columns.filter((c) => c.id !== deletingColumn.id);
      setColumns(remaining);
      if (selectedColumnId === deletingColumn.id) {
        setSelectedColumnId(remaining[0]?.id || null);
      }
      setDeletingColumn(null);
      if (onColumnsUpdated) onColumnsUpdated();
    } catch (err: any) {
      setDeleteErrorMessage(err.message || 'Failed to delete column.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Rule effect summary sentence
  const getRuleSentence = () => {
    if (!selectedCol) return '';

    const viewNames = selectedCol.viewRoleIds
      .map((rId) => roles.find((r) => r.id === rId)?.displayName || rId)
      .join(', ');

    const moveNames = selectedCol.moveRoleIds
      .map((rId) => roles.find((r) => r.id === rId)?.displayName || rId)
      .join(', ');

    const hasViewRules = selectedCol.viewRoleIds.length > 0;
    const hasMoveRules = selectedCol.moveRoleIds.length > 0;

    if (!hasViewRules && !hasMoveRules) {
      return 'Anyone can see this column and move tasks out of it.';
    }

    if (hasViewRules && !hasMoveRules) {
      return `Only ${viewNames} can see this column. Anyone can move tasks out of it.`;
    }

    if (!hasViewRules && hasMoveRules) {
      return `Only ${moveNames} can move tasks out of this column.`;
    }

    return `Only ${viewNames} can see this column, and only ${moveNames} can move tasks out of it.`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border/80">
            <DialogTitle>Board column settings</DialogTitle>
            <DialogDescription>
              Configure columns, role ownership rules, and waiting time limits.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="p-8 space-y-4">
              <div className="h-8 bg-muted animate-pulse rounded-sm" />
              <div className="h-48 bg-muted animate-pulse rounded-sm" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">
              {/* Left sidebar: Columns List */}
              <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border p-3 space-y-3 shrink-0 bg-muted/20">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Columns ({columns.length})
                </div>

                <div className="space-y-1">
                  {columns.map((col, idx) => {
                    const isSelected = col.id === selectedColumnId;
                    return (
                      <div
                        key={col.id}
                        onClick={() => setSelectedColumnId(col.id)}
                        className={`flex items-center justify-between p-2 rounded-sm text-xs cursor-pointer transition-colors border ${
                          isSelected
                            ? 'bg-background border-brand text-foreground font-medium shadow-none'
                            : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          {col.color && (
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: col.color }}
                            />
                          )}
                          <span className="truncate">{col.name}</span>
                          {col.isDone && (
                            <span className="text-[10px] text-muted-foreground shrink-0 font-normal">
                              (Done)
                            </span>
                          )}
                        </div>

                        {/* Reorder actions */}
                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label={`Move ${col.name} up`}
                            onClick={() => handleMoveColumn(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${col.name} down`}
                            onClick={() => handleMoveColumn(idx, 'down')}
                            disabled={idx === columns.length - 1}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add column quick form */}
                <form onSubmit={handleAddColumn} className="pt-2 border-t border-border space-y-2">
                  <Input
                    placeholder="New column name..."
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 gap-1"
                    disabled={!newColName.trim() || isAddingCol}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add column</span>
                  </Button>
                </form>
              </div>

              {/* Right panel: Active Column Editor */}
              {selectedCol ? (
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  {errorMessage && (
                    <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                      {errorMessage}
                    </div>
                  )}

                  {/* Summary sentence */}
                  <div className="p-3 rounded-sm border border-border/80 bg-muted/30 text-xs">
                    <p className="font-medium text-foreground">{getRuleSentence()}</p>
                  </div>

                  {/* Name and Color */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="col-name-input"
                        className="text-xs font-medium text-foreground"
                      >
                        Column name
                      </label>
                      <Input
                        id="col-name-input"
                        value={selectedCol.name}
                        onChange={(e) => updateSelectedCol({ name: e.target.value })}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Column colour
                      </label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => updateSelectedCol({ color: null })}
                          className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                            !selectedCol.color
                              ? 'bg-muted text-foreground border-border font-medium'
                              : 'text-muted-foreground border-transparent hover:border-border'
                          }`}
                        >
                          Default
                        </button>
                        {PRESET_COLORS.map((c) => {
                          const isSelected = selectedCol.color === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => updateSelectedCol({ color: c.value })}
                              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-sm border transition-colors ${
                                isSelected
                                  ? 'border-foreground font-medium bg-muted/40'
                                  : 'border-border/60 hover:border-border'
                              }`}
                            >
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: c.value }}
                              />
                              <span>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Rule 1: Who can see this column */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Who can see this column
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedCol.viewRoleIds.length === 0
                          ? 'Everyone'
                          : `${selectedCol.viewRoleIds.length} role(s)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Empty means everyone on the board can see this column and its tasks.
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedCol({ viewRoleIds: [] })}
                        className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                          selectedCol.viewRoleIds.length === 0
                            ? 'bg-brand text-brand-foreground border-brand font-medium'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Everyone
                      </button>
                      {roles.map((r) => {
                        const isSelected = selectedCol.viewRoleIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedCol.viewRoleIds.filter((id) => id !== r.id)
                                : [...selectedCol.viewRoleIds, r.id];
                              updateSelectedCol({ viewRoleIds: next });
                            }}
                            className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                              isSelected
                                ? 'bg-brand text-brand-foreground border-brand font-medium'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {r.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rule 2: Who can move tasks out of it */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Who can move tasks out of it
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedCol.moveRoleIds.length === 0
                          ? 'Everyone'
                          : `${selectedCol.moveRoleIds.length} role(s)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Empty means anyone with task move permission can advance tasks from here.
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedCol({ moveRoleIds: [] })}
                        className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                          selectedCol.moveRoleIds.length === 0
                            ? 'bg-brand text-brand-foreground border-brand font-medium'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Everyone
                      </button>
                      {roles.map((r) => {
                        const isSelected = selectedCol.moveRoleIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedCol.moveRoleIds.filter((id) => id !== r.id)
                                : [...selectedCol.moveRoleIds, r.id];
                              updateSelectedCol({ moveRoleIds: next });
                            }}
                            className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                              isSelected
                                ? 'bg-brand text-brand-foreground border-brand font-medium'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {r.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Done status toggle */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCol.isDone}
                        onChange={(e) => {
                          const isDone = e.target.checked;
                          updateSelectedCol({
                            isDone,
                            timeLimitHours: isDone ? null : selectedCol.timeLimitHours,
                          });
                        }}
                        className="mt-0.5 size-4 rounded-sm border border-border text-brand focus:ring-ring"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          Mark as done column
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Tasks in a done column are considered completed and stop counting waiting time.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Time limit (only if not done column) */}
                  {!selectedCol.isDone && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="col-time-limit"
                          className="text-xs font-semibold text-foreground"
                        >
                          Time limit in hours
                        </label>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {selectedCol.timeLimitHours ? `${selectedCol.timeLimitHours}h` : 'No limit'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Tasks that stay here longer than this are marked over the limit.
                      </p>

                      <div className="flex items-center gap-2">
                        <Input
                          id="col-time-limit"
                          type="number"
                          min="1"
                          placeholder="Hours (e.g. 4)"
                          value={selectedCol.timeLimitHours ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            updateSelectedCol({ timeLimitHours: val && val > 0 ? val : null });
                          }}
                          className="h-8 text-xs w-32 tabular-nums"
                        />
                        {selectedCol.timeLimitHours && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSelectedCol({ timeLimitHours: null })}
                            className="text-xs h-8 text-muted-foreground"
                          >
                            Remove limit
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions & Delete */}
                  <div className="pt-6 border-t border-border flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromptDelete(selectedCol)}
                      className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete column</span>
                    </Button>

                    <Button
                      id="save-column-settings-btn"
                      type="button"
                      size="sm"
                      onClick={handleSaveCurrentCol}
                      disabled={isSaving}
                      className="bg-brand text-brand-foreground hover:bg-brand/90 text-xs"
                    >
                      {isSaving ? 'Saving...' : 'Save column changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-8 text-center text-xs text-muted-foreground">
                  Select a column to edit its settings.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Column with tasks Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingColumn)}
        onOpenChange={(open) => !open && setDeletingColumn(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete column</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Delete &quot;{deletingColumn?.name}&quot;? If there are tasks in this column, specify where to move them.
            </DialogDescription>
          </DialogHeader>

          {deleteErrorMessage && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {deleteErrorMessage}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="target-col-select" className="text-xs font-medium text-foreground">
                Move existing tasks to:
              </label>
              <select
                id="target-col-select"
                value={targetColumnId}
                onChange={(e) => setTargetColumnId(e.target.value)}
                className="w-full h-9 rounded-sm border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {columns
                  .filter((c) => c.id !== deletingColumn?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isDone ? '(Done)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingColumn(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-col-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete column'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
