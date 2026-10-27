'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, CornerUpLeft, Calendar, Tag, User as UserIcon } from 'lucide-react';
import { formatCompactWaiting, formatCompactDueDate } from '@/lib/format-time';
import type { BoardTask, BoardColumnWithTasks } from '../types';

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  task: BoardTask | null;
  columns?: BoardColumnWithTasks[];
}

export function TaskDetailsDialog({
  open,
  onOpenChange,
  task,
  columns = [],
}: TaskDetailsDialogProps) {
  if (!task) return null;

  const currentColumn = columns.find((c) => c.id === task.columnId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="task-details-dialog"
        className="sm:max-w-[520px] p-6 rounded border border-border bg-card shadow-none space-y-4"
      >
        <DialogHeader className="space-y-1.5 text-left border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground px-1.5 py-0.5 rounded-xs bg-muted/60 border border-border/70">
              {task.key}
            </span>
            {currentColumn && (
              <span className="text-xs font-medium text-foreground px-2 py-0.5 rounded-xs bg-muted/30 border border-border">
                {currentColumn.name}
              </span>
            )}
            <span className="ml-auto text-xs px-2 py-0.5 rounded-xs border font-medium bg-muted/20 text-muted-foreground">
              {task.priority || 'MEDIUM'}
            </span>
          </div>
          <DialogTitle className="text-base font-semibold text-foreground pt-1 leading-snug">
            {task.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Task details for {task.key}
          </DialogDescription>
        </DialogHeader>

        {/* Task Details Content */}
        <div className="space-y-3.5 text-xs">
          {/* Description */}
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </span>
            <p className="text-foreground leading-relaxed bg-muted/15 p-2.5 rounded border border-border/60">
              {task.description || 'No description provided.'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Assignee */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <UserIcon className="size-3" />
                Assignee
              </span>
              <p className="text-foreground font-medium">
                {task.assignee ? task.assignee.name : 'Unassigned'}
              </p>
            </div>

            {/* Waiting Time */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="size-3" />
                Time in column
              </span>
              <p className="text-foreground font-medium tabular-nums">
                {formatCompactWaiting(task.waitingSeconds)}
              </p>
            </div>

            {/* Due date */}
            {task.dueDate && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="size-3" />
                  Due date
                </span>
                <p className="text-foreground font-medium tabular-nums">
                  {formatCompactDueDate(task.dueDate)}
                </p>
              </div>
            )}

            {/* Bounce Count */}
            {task.bounceCount > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <CornerUpLeft className="size-3" />
                  Sent back
                </span>
                <p className="text-amber-700 dark:text-amber-400 font-semibold tabular-nums">
                  {task.bounceCount} time{task.bounceCount === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </div>

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Tag className="size-3" />
                Labels
              </span>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((lbl) => (
                  <span
                    key={lbl.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[11px] border border-border bg-muted/40 text-foreground"
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
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end pt-3 border-t border-border/50">
          <Button
            id="task-details-close-btn"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-sm"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
