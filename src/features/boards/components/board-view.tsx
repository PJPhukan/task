'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import { Settings, RefreshCw, AlertCircle, Columns3 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { BoardColumn } from './board-column';
import { TaskCard } from './task-card';
import { BoardFilters } from './board-filters';
import { SendBackDialog } from './send-back-dialog';
import { ColumnSettingsDialog } from '@/features/columns/components/column-settings-dialog';
import { isDueDateOverdue } from '@/lib/format-time';
import type {
  BoardDetails,
  BoardColumnWithTasks,
  BoardTask,
  TaskUser,
  TaskLabel,
} from '../types';
import type { Project } from '@/types/project';

interface BoardViewProps {
  projectId: string;
  boardId: string;
}

const CACHE_KEY_PREFIX = 'rolane:columns:';
const RULES_CACHE_PREFIX = 'rolane:board-rules:';

export function BoardView({ projectId, boardId }: BoardViewProps) {
  const searchParams = useSearchParams();
  const { can, roles: userRoles } = useCurrentUser();

  const canManageColumns = can('column.manage');
  const canCreateTask = can('task.create');
  const canMoveTask = can('task.move');

  // State
  const [project, setProject] = React.useState<Project | null>(null);
  const [board, setBoard] = React.useState<BoardDetails | null>(null);
  const [columns, setColumns] = React.useState<BoardColumnWithTasks[]>([]);
  const [users, setUsers] = React.useState<TaskUser[]>([]);
  const [labels, setLabels] = React.useState<TaskLabel[]>([]);

  // Cache & Loading indicators
  const [isShowingCachedData, setIsShowingCachedData] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Settings dialog
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = React.useState(false);

  // Drag & drop state
  const [activeTask, setActiveTask] = React.useState<BoardTask | null>(null);

  // Send back dialog state
  const [sendBackTask, setSendBackTask] = React.useState<BoardTask | null>(null);
  const [sendBackSourceCol, setSendBackSourceCol] = React.useState<BoardColumnWithTasks | null>(null);
  const [sendBackTargetCol, setSendBackTargetCol] = React.useState<BoardColumnWithTasks | null>(null);
  const [sendBackTargetIndex, setSendBackTargetIndex] = React.useState<number>(0);
  const [isSendBackOpen, setIsSendBackOpen] = React.useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = React.useState(false);
  const [moveErrorMessage, setMoveErrorMessage] = React.useState<string | null>(null);

  // Keyboard move mode state
  const [keyboardTask, setKeyboardTask] = React.useState<BoardTask | null>(null);
  const [keyboardTargetColId, setKeyboardTargetColId] = React.useState<string | null>(null);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = React.useState<string>('');

  // Live timer tick for waiting times
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Support custom event for testing/triggering reason dialog
  React.useEffect(() => {
    const handleTriggerSendBack = (e: any) => {
      const allTasks = columns.flatMap((c) => c.tasks);
      const task = (e.detail?.taskId ? allTasks.find((t) => t.id === e.detail.taskId) : null) || allTasks[0];
      if (task) {
        const sourceCol = columns.find((c) => c.id === task.columnId) || columns[1] || columns[0];
        const targetCol = columns[0];
        setSendBackTask(task);
        setSendBackSourceCol(sourceCol);
        setSendBackTargetCol(targetCol);
        setSendBackTargetIndex(0);
        setIsSendBackOpen(true);
      }
    };
    window.addEventListener('open-send-back-dialog', handleTriggerSendBack);
    return () => window.removeEventListener('open-send-back-dialog', handleTriggerSendBack);
  }, [columns]);

  // Configure Dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // 1. Load cached columns on mount
  React.useEffect(() => {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${boardId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumns(parsed);
          setIsShowingCachedData(true);
          setInitialLoading(false);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [boardId]);

  // 1b. Offline detection and simulation
  React.useEffect(() => {
    const handleOffline = () => {
      setIsShowingCachedData(true);
      setIsRefreshing(false);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('simulate-offline-mode', handleOffline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('simulate-offline-mode', handleOffline);
    };
  }, []);

  // 2. Fetch full board data
  const fetchBoardData = React.useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // Fetch project, board details, and rich task details in parallel
      const [projRes, boardRes, tasksRes, membersRes, labelsRes] = await Promise.allSettled([
        apiClient.get<{ project: Project }>(`/api/projects/${projectId}`),
        apiClient.get<{ board: any }>(`/api/projects/${projectId}/boards/${boardId}`),
        apiClient.get<{ tasks: any[] }>(`/api/projects/${projectId}/tasks?boardId=${boardId}&pageSize=100`),
        apiClient.get<{ members: Array<{ user: TaskUser }> }>(`/api/projects/${projectId}/members`),
        apiClient.get<{ labels: TaskLabel[] }>(`/api/projects/${projectId}/labels`),
      ]);

      if (projRes.status === 'fulfilled') {
        setProject(projRes.value.project);
      }

      if (boardRes.status !== 'fulfilled') {
        throw boardRes.reason;
      }

      const rawBoard = boardRes.value.board;
      setBoard(rawBoard);

      // Members
      if (membersRes.status === 'fulfilled') {
        const memberUsers = (membersRes.value.members || []).map((m) => m.user);
        setUsers(memberUsers);
      }

      // Labels
      if (labelsRes.status === 'fulfilled') {
        setLabels(labelsRes.value.labels || []);
      }

      // Tasks map by id for rich data (assignee object, labels)
      const richTasksMap = new Map<string, any>();
      if (tasksRes.status === 'fulfilled') {
        for (const t of tasksRes.value.tasks || []) {
          richTasksMap.set(t.id, t);
        }
      }

      // Fetch rules for columns (if user can manage columns or try)
      let cachedRules: Record<string, any> = {};
      try {
        const storedRules = localStorage.getItem(`${RULES_CACHE_PREFIX}${boardId}`);
        if (storedRules) cachedRules = JSON.parse(storedRules);
      } catch {
        // ignore
      }

      const rawCols: any[] = rawBoard.columns || [];
      const updatedRules: Record<string, any> = { ...cachedRules };

      if (canManageColumns) {
        await Promise.all(
          rawCols.map(async (col) => {
            try {
              const r = await apiClient.get<any>(
                `/api/projects/${projectId}/columns/${col.id}/rules`
              );
              updatedRules[col.id] = r;
            } catch {
              // fallback
            }
          })
        );
        try {
          localStorage.setItem(`${RULES_CACHE_PREFIX}${boardId}`, JSON.stringify(updatedRules));
        } catch {
          // ignore
        }
      }

      // Assemble columns with tasks
      const userRoleNames = (userRoles || []).map((r) => (r.displayName || r.id || '').toLowerCase());
      const isAdmin = userRoleNames.includes('admin') || userRoleNames.includes('superadmin') || canManageColumns;

      const assembledColumns: BoardColumnWithTasks[] = rawCols.map((col: any) => {
        const colRules = updatedRules[col.id] || {};
        let moveRoles = colRules.moveRoles || [];
        if (moveRoles.length === 0) {
          const lowerName = (col.name || '').toLowerCase();
          if (lowerName.includes('to do') || lowerName.includes('todo') || lowerName.includes('progress') || lowerName.includes('dev')) {
            moveRoles = [{ id: 'developer', name: 'Developer', displayName: 'Developer' }];
          } else if (lowerName.includes('qa') || lowerName.includes('review') || lowerName.includes('test')) {
            moveRoles = [{ id: 'qa', name: 'QA', displayName: 'QA' }];
          } else if (lowerName.includes('prod') || lowerName.includes('deploy') || lowerName.includes('stage')) {
            moveRoles = [{ id: 'deployment', name: 'Deployment', displayName: 'Deployment' }];
          } else if (col.isDone || lowerName.includes('done')) {
            moveRoles = [{ id: 'done', name: 'Done', displayName: 'Done' }];
          }
        }

        let canMoveThisCol = canMoveTask;
        if (!isAdmin && moveRoles.length > 0 && canMoveTask) {
          const userHasRole = moveRoles.some((mr: any) =>
            userRoleNames.includes((mr.name || mr.displayName || mr.id || '').toLowerCase())
          );
          if (!userHasRole) {
            canMoveThisCol = false;
          }
        }

        const colTasks: BoardTask[] = (col.tasks || []).map((t: any) => {
          const rich = richTasksMap.get(t.id);
          return {
            id: t.id,
            projectId: t.projectId,
            boardId: t.boardId,
            columnId: t.columnId,
            number: t.number,
            key: t.key,
            title: t.title,
            description: t.description,
            priority: t.priority || 'MEDIUM',
            startDate: t.startDate,
            dueDate: t.dueDate,
            assigneeId: t.assigneeId,
            assignee: rich?.assignee || t.assignee || null,
            reporterId: t.reporterId,
            reporter: rich?.reporter || t.reporter || null,
            position: t.position ?? 0,
            completedAt: t.completedAt,
            bounceCount: t.bounceCount ?? 0,
            waitingSeconds: t.waitingSeconds ?? 0,
            overLimit: Boolean(t.overLimit),
            labels: rich?.labels || t.labels || [],
            stageHistory: t.stageHistory || [],
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          };
        });

        return {
          id: col.id,
          boardId: col.boardId,
          name: col.name,
          color: col.color,
          position: col.position,
          isDone: col.isDone,
          timeLimitHours: col.timeLimitHours,
          canMove: canMoveThisCol,
          tasks: colTasks,
          moveRoles: moveRoles,
          viewRoles: colRules.viewRoles || [],
          createdAt: col.createdAt,
          updatedAt: col.updatedAt,
        };
      });

      assembledColumns.sort((a, b) => a.position - b.position);
      setColumns(assembledColumns);

      // Save column layout and data to browser cache
      try {
        localStorage.setItem(
          `${CACHE_KEY_PREFIX}${boardId}`,
          JSON.stringify(assembledColumns)
        );
      } catch {
        // ignore
      }

      setIsShowingCachedData(false);
      setErrorMessage(null);
    } catch (err: any) {
      if (columns.length > 0) {
        // If we already have cached columns, retain them and show saved state
        setIsShowingCachedData(true);
      } else {
        setErrorMessage(err?.message || 'Failed to load board.');
      }
    } finally {
      setIsRefreshing(false);
      setInitialLoading(false);
    }
  }, [projectId, boardId, canManageColumns, columns.length]);

  React.useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Recalculate live waitingSeconds and dynamic column move permissions
  const liveColumns = React.useMemo(() => {
    const userRoleNames = (userRoles || []).map((r) => (r.displayName || r.id || '').toLowerCase());
    const isAdmin = userRoleNames.includes('admin') || userRoleNames.includes('superadmin') || canManageColumns;

    return columns.map((col) => {
      let canMoveThisCol = canMoveTask;
      const moveRoles = col.moveRoles || [];
      if (!isAdmin && moveRoles.length > 0 && canMoveTask) {
        const userHasRole = moveRoles.some((mr: any) =>
          userRoleNames.includes((mr.name || mr.displayName || mr.id || '').toLowerCase())
        );
        if (!userHasRole) {
          canMoveThisCol = false;
        }
      }

      if (col.isDone) {
        return {
          ...col,
          canMove: canMoveThisCol,
        };
      }
      const updatedTasks = col.tasks.map((task) => {
        let liveSeconds = task.waitingSeconds;
        if (task.stageHistory && task.stageHistory.length > 0) {
          const entry = task.stageHistory[0];
          if (entry.enteredAt) {
            const entered = new Date(entry.enteredAt).getTime();
            liveSeconds = Math.max(0, Math.floor((nowMs - entered) / 1000));
          }
        }
        const isOver = col.timeLimitHours ? liveSeconds > col.timeLimitHours * 3600 : task.overLimit;
        return {
          ...task,
          waitingSeconds: liveSeconds,
          overLimit: isOver,
        };
      });
      return {
        ...col,
        canMove: canMoveThisCol,
        tasks: updatedTasks,
      };
    });
  }, [columns, nowMs, userRoles, canManageColumns, canMoveTask]);

  // Apply URL filters to tasks
  const searchQuery = (searchParams.get('q') || '').toLowerCase().trim();
  const assigneeFilter = searchParams.get('assignee') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const labelFilter = searchParams.get('label') || '';
  const overdueFilter = searchParams.get('overdue') === 'true';

  let totalTasksCount = 0;
  let filteredTasksCount = 0;

  const filteredColumns = React.useMemo(() => {
    return liveColumns.map((col) => {
      totalTasksCount += col.tasks.length;

      const filteredTasks = col.tasks.filter((task) => {
        // Text search
        if (searchQuery) {
          const keyMatches = task.key.toLowerCase().includes(searchQuery);
          const titleMatches = task.title.toLowerCase().includes(searchQuery);
          if (!keyMatches && !titleMatches) return false;
        }

        // Assignee filter
        if (assigneeFilter) {
          if (assigneeFilter === 'unassigned') {
            if (task.assigneeId) return false;
          } else {
            if (task.assigneeId !== assigneeFilter) return false;
          }
        }

        // Priority filter
        if (priorityFilter) {
          if (task.priority !== priorityFilter) return false;
        }

        // Label filter
        if (labelFilter) {
          const hasLabel = task.labels?.some((l) => l.id === labelFilter);
          if (!hasLabel) return false;
        }

        // Overdue filter
        if (overdueFilter) {
          const isOver = task.overLimit || (!col.isDone && isDueDateOverdue(task.dueDate));
          if (!isOver) return false;
        }

        return true;
      });

      filteredTasksCount += filteredTasks.length;

      return {
        ...col,
        tasks: filteredTasks,
      };
    });
  }, [liveColumns, searchQuery, assigneeFilter, priorityFilter, labelFilter, overdueFilter]);

  // Execute task move request
  const performMove = async (
    taskId: string,
    targetColId: string,
    targetIndex: number,
    reason?: string
  ) => {
    setIsSubmittingMove(true);
    setMoveErrorMessage(null);

    // Find original task and columns
    let sourceCol: BoardColumnWithTasks | null = null;
    let targetCol: BoardColumnWithTasks | null = null;
    let taskToMove: BoardTask | null = null;

    for (const c of columns) {
      if (c.id === targetColId) targetCol = c;
      const found = c.tasks.find((t) => t.id === taskId);
      if (found) {
        sourceCol = c;
        taskToMove = found;
      }
    }

    if (!sourceCol || !targetCol || !taskToMove) {
      setIsSubmittingMove(false);
      return;
    }

    const isBackward = targetCol.position < sourceCol.position;

    // Optimistic update if forward or same column
    const previousColumns = columns;
    if (!isBackward) {
      const nextColumns = columns.map((c) => {
        if (c.id === sourceCol?.id && c.id === targetCol?.id) {
          // Reorder in same column
          const remaining = c.tasks.filter((t) => t.id !== taskId);
          remaining.splice(targetIndex, 0, taskToMove!);
          return { ...c, tasks: remaining };
        }
        if (c.id === sourceCol?.id) {
          return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
        }
        if (c.id === targetCol?.id) {
          const movedTask: BoardTask = {
            ...taskToMove!,
            columnId: targetColId,
            waitingSeconds: 0,
            stageHistory: [{ enteredAt: new Date().toISOString() }],
          };
          const nextTasks = [...c.tasks];
          nextTasks.splice(targetIndex, 0, movedTask);
          return { ...c, tasks: nextTasks };
        }
        return c;
      });
      setColumns(nextColumns);
    }

    try {
      const payload: any = {
        columnId: targetColId,
        index: targetIndex,
      };
      if (reason) {
        payload.reason = reason;
      }

      await apiClient.patch(
        `/api/projects/${projectId}/tasks/${taskId}/move`,
        payload
      );

      // Successfully moved, refresh board data to sync stage history & bounce count
      await fetchBoardData();
    } catch (err: any) {
      // Revert optimistic update on failure
      setColumns(previousColumns);
      const msg = err?.message || 'Failed to move task.';
      setMoveErrorMessage(msg);
      throw err;
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Quick Add task at bottom of column
  const handleQuickAddTask = async (columnId: string, title: string) => {
    try {
      await apiClient.post(`/api/projects/${projectId}/tasks`, {
        boardId,
        columnId,
        title,
      });
      await fetchBoardData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create task.');
      throw err;
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as BoardTask | undefined;
    if (task) {
      setActiveTask(task);
      setMoveErrorMessage(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const task = active.data.current?.task as BoardTask | undefined;
    const sourceColId = active.data.current?.columnId as string | undefined;

    if (!task || !sourceColId) return;

    // Resolve target column ID
    let targetColId: string | null = null;
    let targetIndex = 0;

    // Did user drop over a column or a task inside a column?
    const overCol = columns.find((c) => c.id === over.id);
    if (overCol) {
      targetColId = overCol.id;
      targetIndex = overCol.tasks.length;
    } else {
      // Dropped over another task
      for (const c of columns) {
        const idx = c.tasks.findIndex((t) => t.id === over.id);
        if (idx !== -1) {
          targetColId = c.id;
          targetIndex = idx;
          break;
        }
      }
    }

    if (!targetColId) return;

    // Find source and target column objects
    const sourceCol = columns.find((c) => c.id === sourceColId);
    const targetCol = columns.find((c) => c.id === targetColId);

    if (!sourceCol || !targetCol) return;

    // Check if user is allowed to move from this column
    if (!canMoveTask || (sourceCol.canMove === false)) {
      setMoveErrorMessage(`Cannot move tasks from ${sourceCol.name}.`);
      return;
    }

    // Check if this is a backward move
    const isBackward = targetCol.position < sourceCol.position;

    if (isBackward) {
      // Require reason dialog
      setSendBackTask(task);
      setSendBackSourceCol(sourceCol);
      setSendBackTargetCol(targetCol);
      setSendBackTargetIndex(targetIndex);
      setIsSendBackOpen(true);
      return;
    }

    // Forward move or reorder
    try {
      await performMove(task.id, targetCol.id, targetIndex);
    } catch {
      // error handled in performMove
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  // Keyboard navigation
  const handleKeyboardInitiate = (task: BoardTask) => {
    const sourceCol = columns.find((c) => c.id === task.columnId);
    if (!sourceCol || !canMoveTask || (sourceCol.canMove === false)) return;

    setKeyboardTask(task);
    setKeyboardTargetColId(task.columnId);
    setScreenReaderAnnouncement(
      `Picked up task ${task.key}: ${task.title}. Use Left or Right Arrow keys to choose a column, Space to drop, Escape to cancel.`
    );
  };

  React.useEffect(() => {
    if (!keyboardTask) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keyboardTask || !keyboardTargetColId) return;

      const currentIdx = columns.findIndex((c) => c.id === keyboardTargetColId);
      if (currentIdx === -1) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = Math.min(columns.length - 1, currentIdx + 1);
        const nextCol = columns[nextIdx];
        setKeyboardTargetColId(nextCol.id);
        setScreenReaderAnnouncement(
          `Selected column: ${nextCol.name} (column ${nextIdx + 1} of ${columns.length}). Press Space to drop.`
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = Math.max(0, currentIdx - 1);
        const prevCol = columns[prevIdx];
        setKeyboardTargetColId(prevCol.id);
        setScreenReaderAnnouncement(
          `Selected column: ${prevCol.name} (column ${prevIdx + 1} of ${columns.length}). Press Space to drop.`
        );
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const targetCol = columns[currentIdx];
        const sourceCol = columns.find((c) => c.id === keyboardTask.columnId);
        if (!sourceCol || !targetCol) return;

        const isBackward = targetCol.position < sourceCol.position;
        if (isBackward) {
          setSendBackTask(keyboardTask);
          setSendBackSourceCol(sourceCol);
          setSendBackTargetCol(targetCol);
          setSendBackTargetIndex(targetCol.tasks.length);
          setIsSendBackOpen(true);
          setKeyboardTask(null);
          setKeyboardTargetColId(null);
        } else {
          performMove(keyboardTask.id, targetCol.id, targetCol.tasks.length);
          setScreenReaderAnnouncement(`Moved task ${keyboardTask.key} to ${targetCol.name}.`);
          setKeyboardTask(null);
          setKeyboardTargetColId(null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setKeyboardTask(null);
        setKeyboardTargetColId(null);
        setScreenReaderAnnouncement('Move cancelled.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardTask, keyboardTargetColId, columns]);

  // Loading skeleton state (only if no cached data)
  if (initialLoading && columns.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-sm" />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-72 sm:w-80 h-96 rounded border border-border bg-card p-3 space-y-3">
              <div className="h-5 w-24 bg-muted animate-pulse rounded-sm" />
              <div className="h-24 bg-muted animate-pulse rounded-sm" />
              <div className="h-24 bg-muted animate-pulse rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state (only if no columns or board could be rendered)
  if (errorMessage && columns.length === 0) {
    return (
      <div className="p-12 text-center space-y-3 rounded border border-border bg-card max-w-md mx-auto my-12">
        <AlertCircle className="size-8 text-destructive mx-auto" />
        <h2 className="text-sm font-semibold text-foreground">Could not load board</h2>
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBoardData}
          className="text-xs rounded-sm mt-2"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3">
      {/* Hidden screen reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {screenReaderAnnouncement}
      </div>

      {/* Page Header */}
      <PageHeader
        title={board?.name || 'Board'}
        description={`Workflow board for ${project?.name || 'Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name || 'Project', href: `/projects/${projectId}` },
          { label: board?.name || 'Board' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Small plain cached data indicator */}
            {isShowingCachedData && (
              <div
                id="saved-data-indicator"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-border text-[11px] font-medium text-muted-foreground bg-muted/40"
              >
                {isRefreshing && <RefreshCw className="size-3 animate-spin text-muted-foreground" />}
                <span>Showing saved data{isRefreshing ? '. Refreshing...' : ''}</span>
              </div>
            )}

            {canManageColumns && (
              <Button
                id="column-settings-btn"
                variant="outline"
                size="sm"
                onClick={() => setIsColumnSettingsOpen(true)}
                className="gap-1.5 text-xs rounded-sm h-8"
              >
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Column settings</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Move error notice banner */}
      {moveErrorMessage && (
        <div className="flex items-center justify-between p-2.5 rounded-sm border border-destructive/40 bg-destructive/10 text-xs text-destructive">
          <span>{moveErrorMessage}</span>
          <button
            type="button"
            onClick={() => setMoveErrorMessage(null)}
            className="text-destructive font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* URL Filters */}
      <BoardFilters
        users={users}
        labels={labels}
        totalTasksCount={totalTasksCount}
        filteredTasksCount={filteredTasksCount}
      />

      {/* Board Body */}
      {columns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded border border-border bg-card">
          <Columns3 className="size-10 text-muted-foreground mb-3" />
          <h2 className="text-sm font-semibold text-foreground">This board has no columns</h2>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Add columns to start moving tasks through stages.
          </p>
          {canManageColumns && (
            <Button
              size="sm"
              onClick={() => setIsColumnSettingsOpen(true)}
              className="text-xs rounded-sm bg-brand text-brand-foreground hover:bg-brand/90"
            >
              Configure columns
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Horizontal scroll container for columns */}
          <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-2 items-start">
            {filteredColumns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                canCreateTask={canCreateTask}
                canMoveTasks={canMoveTask}
                activeTaskId={activeTask?.id}
                keyboardSelectedTaskId={keyboardTask?.id}
                isKeyboardTargetColumn={keyboardTargetColId === col.id}
                onQuickAddTask={handleQuickAddTask}
                onKeyboardInitiate={handleKeyboardInitiate}
              />
            ))}
          </div>

          {/* Drag Overlay for smooth card preview */}
          <DragOverlay>
            {activeTask ? (
              <div className="w-72 sm:w-80 rotate-1 shadow-none">
                <TaskCard
                  task={activeTask}
                  columnId={activeTask.columnId}
                  columnPosition={0}
                  canMoveFromColumn={true}
                  isDragging={true}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Reason Dialog for Send Back (Backward Moves) */}
      <SendBackDialog
        open={isSendBackOpen}
        onOpenChange={setIsSendBackOpen}
        task={sendBackTask}
        sourceColumn={sendBackSourceCol}
        targetColumn={sendBackTargetCol}
        onConfirm={async (reason) => {
          if (!sendBackTask || !sendBackTargetCol) return;
          await performMove(
            sendBackTask.id,
            sendBackTargetCol.id,
            sendBackTargetIndex,
            reason
          );
        }}
        isSubmitting={isSubmittingMove}
      />

      {/* Column settings dialog */}
      <ColumnSettingsDialog
        projectId={projectId}
        boardId={boardId}
        open={isColumnSettingsOpen}
        onOpenChange={setIsColumnSettingsOpen}
        onColumnsUpdated={fetchBoardData}
      />
    </div>
  );
}
