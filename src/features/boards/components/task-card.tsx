'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, AlertTriangle, CornerUpLeft, Calendar } from 'lucide-react';
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
  onKeyboardInitiate?: (_task: BoardTask) => void;
}

export function TaskCard({
  task,
  columnId,
  columnPosition,
  columnTimeLimitHours,
  columnIsDone = false,
  canMoveFromColumn,
  owningRoleName,
  isDragging = false,
  isKeyboardSelected = false,
  onKeyboardInitiate,
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
    if (isReadOnly) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (onKeyboardInitiate) {
        onKeyboardInitiate(task);
      }
    }
  };

  const readOnlyMessage = owningRoleName
    ? `Only ${owningRoleName} can move tasks out of this column.`
    : 'You cannot move tasks out of this column.';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isReadOnly ? attributes : {})}
      {...(!isReadOnly ? listeners : {})}
      tabIndex={isReadOnly ? 0 : 0}
      role="button"
      aria-roledescription={isReadOnly ? 'read-only task card' : 'draggable task card'}
      aria-label={`${task.key}: ${task.title}. Priority ${priorityConfig.label}.${isReadOnly ? ` ${readOnlyMessage}` : ' Press Space to pick up.'}`}
      onKeyDown={handleKeyDown}
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
      {/* Top row: Key, Priority, and Waiting time */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-semibold tracking-tight text-foreground/90">
            {task.key}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.2 rounded-xs text-[10px] font-medium border ${priorityConfig.bgClass}`}
          >
            {priorityConfig.label}
          </span>
        </div>

        {/* Waiting time metric */}
        <div className="flex items-center gap-1 shrink-0">
          {isTaskOverLimit ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs font-semibold tabular-nums text-[10px] bg-[hsl(var(--over-limit))]/10 text-[hsl(var(--over-limit))] border border-[hsl(var(--over-limit))]/30"
              title="Task has exceeded column time limit"
            >
              <AlertTriangle className="size-3" />
              <span>Over limit ({formatCompactWaiting(task.waitingSeconds)})</span>
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

      {/* Title */}
      <p className="pt-2 pb-2 text-[13px] font-normal leading-snug text-foreground break-words">
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
          <span className="text-muted-foreground/60 italic text-[11px]">Unassigned</span>
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

      {/* Read-only rule message */}
      {isReadOnly && (
        <div className="mt-2 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground/80 leading-tight">
          {readOnlyMessage}
        </div>
      )}
    </div>
  );
}
