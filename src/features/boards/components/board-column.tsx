'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Clock, Plus, CheckCircle2, Shield } from 'lucide-react';
import { TaskCard } from './task-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { BoardColumnWithTasks, BoardTask } from '../types';

interface BoardColumnProps {
  column: BoardColumnWithTasks;
  canCreateTask: boolean;
  canMoveTasks: boolean;
  canUpdateTask?: boolean;
  activeTaskId?: string | null;
  keyboardSelectedTaskId?: string | null;
  isKeyboardTargetColumn?: boolean;
  onQuickAddTask: (_columnId: string, _title: string) => Promise<void>;
  onTakeTask?: (_taskId: string) => void;
  onKeyboardInitiate?: (_task: BoardTask) => void;
  onKeyboardDrop?: () => void;
  onCardClick?: (_task: BoardTask) => void;
  onRefusedMove?: (_column: BoardColumnWithTasks) => void;
}

export function BoardColumn({
  column,
  canCreateTask,
  canMoveTasks,
  canUpdateTask = false,
  activeTaskId,
  keyboardSelectedTaskId,
  isKeyboardTargetColumn = false,
  onQuickAddTask,
  onTakeTask,
  onKeyboardInitiate,
  onKeyboardDrop,
  onCardClick,
  onRefusedMove,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      column,
    },
  });

  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);
  const [quickAddTitle, setQuickAddTitle] = React.useState('');
  const [isSubmittingTask, setIsSubmittingTask] = React.useState(false);

  // Derive owning role display name
  const moveRoles = column.moveRoles || [];
  const owningRoleNames = moveRoles
    .map((r) => {
      const name = r.displayName || r.name || r.id;
      if (name.endsWith('s') || name.endsWith('sh') || name.endsWith('ch')) return `${name}es`;
      return `${name}s`;
    })
    .join(', ');
  const owningRoleText = moveRoles.map((r) => r.displayName || r.name || r.id).join(', ') || 'Anyone';

  // Owning role distinct style
  const roleStyle = React.useMemo(() => {
    const lower = owningRoleText.toLowerCase();
    if (lower.includes('developer') || lower.includes('dev')) {
      return {
        bg: 'bg-[hsl(var(--column-dev))] text-white',
        border: 'border-[hsl(var(--column-dev))]',
      };
    }
    if (lower.includes('qa') || lower.includes('tester')) {
      return {
        bg: 'bg-[hsl(var(--column-qa))] text-white',
        border: 'border-[hsl(var(--column-qa))]',
      };
    }
    if (lower.includes('deploy') || lower.includes('ops')) {
      return {
        bg: 'bg-[hsl(var(--column-deploy))] text-white',
        border: 'border-[hsl(var(--column-deploy))]',
      };
    }
    if (column.isDone || lower.includes('done')) {
      return {
        bg: 'bg-[hsl(var(--column-done))] text-white',
        border: 'border-[hsl(var(--column-done))]',
      };
    }
    if (owningRoleText === 'Anyone') {
      return {
        bg: 'bg-muted text-muted-foreground',
        border: 'border-border',
      };
    }
    return {
      bg: 'bg-brand text-brand-foreground',
      border: 'border-brand',
    };
  }, [owningRoleText, column.isDone]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickAddTitle.trim();
    if (!title || isSubmittingTask) return;

    setIsSubmittingTask(true);
    try {
      await onQuickAddTask(column.id, title);
      setQuickAddTitle('');
      setIsQuickAddOpen(false);
    } catch {
      // Handled in parent
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsQuickAddOpen(false);
      setQuickAddTitle('');
    }
  };

  const tasks = column.tasks || [];
  const canMoveFromThisColumn = canMoveTasks && (column.canMove ?? true);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 sm:w-80 shrink-0 flex flex-col h-full rounded border transition-colors select-none ${
        isKeyboardTargetColumn
          ? 'ring-2 ring-brand border-brand bg-card'
          : isOver
          ? 'border-brand/70 bg-muted/20'
          : 'border-border bg-card/60'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-border bg-muted/25 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Column name & color badge */}
          <div className="flex items-center gap-2 min-w-0">
            {column.color && (
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: column.color }}
              />
            )}
            <h2 className="text-xs font-semibold text-foreground tracking-tight truncate">
              {column.name}
            </h2>
          </div>

          {/* Task count */}
          <span
            className="text-[11px] font-medium text-muted-foreground tabular-nums px-1.5 py-0.2 rounded-xs border border-border/60 bg-background"
            aria-label={`${tasks.length} tasks`}
          >
            {tasks.length}
          </span>
        </div>

        {/* Distinct owning role badge & column meta */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Memorable element: Owning role badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-semibold tracking-wide uppercase ${roleStyle.bg}`}
              title={`Move rule owner: ${owningRoleText}`}
            >
              <Shield className="size-2.5" />
              <span className="truncate">{owningRoleText}</span>
            </span>
          </div>

          {/* Time limit or Done */}
          <div className="text-[11px] shrink-0 text-muted-foreground tabular-nums">
            {column.isDone ? (
              <span className="inline-flex items-center gap-1 text-[hsl(var(--success))] font-medium">
                <CheckCircle2 className="size-3" />
                <span>Done</span>
              </span>
            ) : column.timeLimitHours ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                <Clock className="size-3 text-muted-foreground/80" />
                <span>{column.timeLimitHours}h limit</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Read-only rule notice shown once in header below owning role */}
        {!canMoveFromThisColumn && moveRoles.length > 0 && (
          <p className="text-[11px] text-muted-foreground/90 pt-1 leading-tight border-t border-border/40 mt-1">
            Only {owningRoleNames} can move tasks out of this column.
          </p>
        )}
      </div>

      {/* Task Cards List - Single vertical scroll per column */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {tasks.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-muted-foreground/80 rounded border border-dashed border-border/70 my-2">
            No tasks here. Move a task in, or create one.
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              columnPosition={column.position}
              columnTimeLimitHours={column.timeLimitHours}
              columnIsDone={column.isDone}
              canMoveFromColumn={canMoveFromThisColumn}
              owningRoleName={owningRoleNames}
              isDragging={activeTaskId === task.id}
              isKeyboardSelected={keyboardSelectedTaskId === task.id}
              canUpdateTask={canUpdateTask}
              onTakeTask={onTakeTask}
              onKeyboardInitiate={onKeyboardInitiate}
              onKeyboardDrop={onKeyboardDrop}
              onCardClick={onCardClick}
              onRefusedMove={() => onRefusedMove?.(column)}
            />
          ))
        )}
      </div>

      {/* Quick Add at foot of column */}
      {canCreateTask && (
        <div className="p-2 border-t border-border/70 shrink-0 bg-background/50">
          {isQuickAddOpen ? (
            <form onSubmit={handleQuickAddSubmit} className="space-y-1.5">
              <Input
                autoFocus
                placeholder="Task title..."
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={handleQuickAddKeyDown}
                disabled={isSubmittingTask}
                className="h-8 text-xs bg-background rounded-sm border-border focus:ring-ring"
              />
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsQuickAddOpen(false);
                    setQuickAddTitle('');
                  }}
                  disabled={isSubmittingTask}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!quickAddTitle.trim() || isSubmittingTask}
                  className="h-6 px-2 text-[11px] rounded-sm bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {isSubmittingTask ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(true)}
              className="w-full flex items-center gap-1.5 p-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Plus className="size-3.5" />
              <span>+ New task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
