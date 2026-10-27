'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, AlertTriangle, CornerUpLeft, Calendar, CheckCircle2 } from 'lucide-react';
import { formatCompactWaiting, formatCompactDueDate, isDueDateOverdue } from '@/lib/format-time';
import type { BoardTask } from '../types';

interface TaskCardProps {
  task: BoardTask;
  columnId: string;
  columnPosition: number;
  columnTimeLimitHours?: number | null;
  columnIsDone?: boolean;
  canMoveFromColumn: boolean;
  owningRoleName?: string;
  isDragging?: boolean;
  isKeyboardSelected?: boolean;
  canUpdateTask?: boolean;
  onTakeTask?: (_taskId: string) => void;
  onKeyboardInitiate?: (_task: BoardTask) => void;
  onKeyboardDrop?: () => void;
  onCardClick?: (_task: BoardTask) => void;
  onRefusedMove?: () => void;
}

export function TaskCard({
  task,
  columnId,
  columnPosition,
  columnTimeLimitHours,
  columnIsDone = false,
  canMoveFromColumn,
  owningRoleName: _owningRoleName,
  isDragging = false,
  isKeyboardSelected = false,
  canUpdateTask = false,
  onTakeTask,
  onKeyboardInitiate,
  onKeyboardDrop,
  onCardClick,
  onRefusedMove,
}: TaskCardProps) {
  const isReadOnly = !canMoveFromColumn;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isNodeDragging,
  } = useDraggable({
    id: task.id,
    data: {
      task,
      columnId,
      columnPosition,
    },
    disabled: isReadOnly,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // Check over-limit condition
  const isTaskOverLimit = React.useMemo(() => {
    if (columnIsDone) return false;
    if (task.overLimit) return true;
    if (columnTimeLimitHours && columnTimeLimitHours > 0) {
      return task.waitingSeconds > columnTimeLimitHours * 3600;
    }
    return false;
  }, [columnIsDone, task.overLimit, task.waitingSeconds, columnTimeLimitHours]);

  const overSeconds = React.useMemo(() => {
    if (columnTimeLimitHours && columnTimeLimitHours > 0) {
      return Math.max(0, task.waitingSeconds - columnTimeLimitHours * 3600);
    }
    return task.waitingSeconds;
  }, [task.waitingSeconds, columnTimeLimitHours]);

  // Check overdue condition
  const isOverdue = React.useMemo(() => {
    if (columnIsDone) return false;
    return isDueDateOverdue(task.dueDate);
  }, [columnIsDone, task.dueDate]);

  // Priority color config
  const priorityConfig = {
    LOW: {
      label: 'Low',
      bgClass: 'bg-[hsl(var(--priority-low))]/10 text-[hsl(var(--priority-low))] border-[hsl(var(--priority-low))]/30',
      dotClass: 'bg-[hsl(var(--priority-low))]',
    },
    MEDIUM: {
      label: 'Medium',
      bgClass: 'bg-[hsl(var(--priority-medium))]/10 text-[hsl(var(--priority-medium))] border-[hsl(var(--priority-medium))]/30',
      dotClass: 'bg-[hsl(var(--priority-medium))]',
    },
    HIGH: {
      label: 'High',
      bgClass: 'bg-[hsl(var(--priority-high))]/10 text-[hsl(var(--priority-high))] border-[hsl(var(--priority-high))]/30',
      dotClass: 'bg-[hsl(var(--priority-high))]',
    },
    URGENT: {
      label: 'Urgent',
      bgClass: 'bg-[hsl(var(--priority-urgent))]/10 text-[hsl(var(--priority-urgent))] border-[hsl(var(--priority-urgent))]/30',
      dotClass: 'bg-[hsl(var(--priority-urgent))]',
    },
  }[task.priority || 'MEDIUM'];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isReadOnly) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onRefusedMove?.();
      }
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (isKeyboardSelected) {
        if (onKeyboardDrop) {
          onKeyboardDrop();
        }
      } else {
        if (onKeyboardInitiate) {
          onKeyboardInitiate(task);
        }
      }
    }
  };

  const handleClick = (_e: React.MouseEvent) => {
    if (isNodeDragging || isDragging) return;
    onCardClick?.(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isReadOnly ? attributes : {})}
      {...(!isReadOnly ? listeners : {})}
      tabIndex={isReadOnly ? 0 : 0}
      role="button"
      aria-roledescription={isReadOnly ? 'read-only task card' : 'draggable task card'}
      aria-label={`${task.key}: ${task.title}. Priority ${priorityConfig.label}.${isReadOnly ? '' : ' Press Space to pick up.'}`}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      data-task-id={task.id}
      data-task-key={task.key}
      className={`group relative rounded border p-3 text-xs transition-colors outline-none select-none ${
        isKeyboardSelected
          ? 'ring-2 ring-brand border-brand bg-card'
          : isNodeDragging || isDragging
          ? 'opacity-40 border-dashed border-brand bg-muted/40'
          : isReadOnly
          ? 'border-border bg-card/75 opacity-90 cursor-default'
          : 'border-border bg-card hover:border-border/90 hover:bg-muted/15 cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Top row: Key (secondary), Priority, and Waiting time / Done status */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-medium tracking-tight text-muted-foreground/80">
            {task.key}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.2 rounded-xs text-[10px] font-medium border ${priorityConfig.bgClass}`}
          >
            {priorityConfig.label}
          </span>
        </div>

        {/* Waiting time / Done metric */}
        <div className="flex items-center gap-1 shrink-0">
          {columnIsDone ? (
            <span
              className="inline-flex items-center gap-1 font-medium text-muted-foreground text-[11px]"
              title={
                task.completedAt
                  ? `Completed on ${formatCompactDueDate(task.completedAt)}`
                  : 'Completed task'
              }
            >
              <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>
                {(() => {
                  if (task.completedAt && task.createdAt) {
                    const sec = Math.floor(
                      (new Date(task.completedAt).getTime() -
                        new Date(task.createdAt).getTime()) /
                        1000
                    );
                    if (sec > 0) {
                      return `Done ${formatCompactWaiting(sec)}`;
                    }
                  }
                  return 'Done';
                })()}
              </span>
            </span>
          ) : isTaskOverLimit ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs font-semibold tabular-nums text-[10px] bg-[hsl(var(--over-limit))]/10 text-[hsl(var(--over-limit))] border border-[hsl(var(--over-limit))]/30"
              title="Task has exceeded column time limit"
            >
              <AlertTriangle className="size-3" />
              <span>Over by {formatCompactWaiting(overSeconds > 0 ? overSeconds : task.waitingSeconds)}</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 tabular-nums font-medium text-muted-foreground text-[11px]"
              title={`In column for ${formatCompactWaiting(task.waitingSeconds)}`}
            >
              <Clock className="size-3 text-muted-foreground/70" />
              <span>{formatCompactWaiting(task.waitingSeconds)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Title - Strongest text on card, truncated inside card with ellipsis */}
      <p
        className="pt-2 pb-2 text-[13px] font-semibold leading-snug text-foreground break-words line-clamp-2 overflow-hidden text-ellipsis"
        title={task.title}
      >
        {task.title}
      </p>

      {/* Due date, Assignee & Labels */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        {/* Due date */}
        {task.dueDate && (
          <div
            className={`inline-flex items-center gap-1 tabular-nums rounded-xs px-1.5 py-0.5 border ${
              isOverdue
                ? 'bg-[hsl(var(--over-limit))]/10 text-[hsl(var(--over-limit))] border-[hsl(var(--over-limit))]/30 font-medium'
                : 'border-border/60 bg-muted/20 text-muted-foreground'
            }`}
          >
            <Calendar className="size-3" />
            <span>{formatCompactDueDate(task.dueDate)}</span>
            {isOverdue && <span className="font-semibold text-[10px]">Overdue</span>}
          </div>
        )}

        {/* Assignee */}
        {task.assignee ? (
          <div className="inline-flex items-center gap-1 text-muted-foreground max-w-[140px] truncate">
            <div className="size-4 rounded-full bg-brand/15 text-brand flex items-center justify-center text-[9px] font-semibold shrink-0">
              {task.assignee.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{task.assignee.name}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground font-normal text-[11px]">Unassigned</span>
            {!isReadOnly && canUpdateTask && onTakeTask && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTakeTask(task.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded-xs bg-brand/10 hover:bg-brand/20 text-brand border border-brand/25 transition-colors cursor-pointer"
              >
                Take
              </button>
            )}
          </div>
        )}

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {task.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="inline-flex items-center px-1.5 py-0.2 rounded-xs text-[10px] border border-border/60 bg-muted/40 text-foreground/80 font-normal"
                style={
                  lbl.color
                    ? {
                        borderLeftWidth: '3px',
                        borderLeftColor: lbl.color,
                      }
                    : undefined
                }
              >
                {lbl.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bounce count indicator if task was sent back */}
      {task.bounceCount > 0 && (
        <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
          <CornerUpLeft className="size-3 shrink-0" />
          <span>
            Sent back {task.bounceCount} time{task.bounceCount === 1 ? '' : 's'}
          </span>
        </div>
      )}
    </div>
  );
}
