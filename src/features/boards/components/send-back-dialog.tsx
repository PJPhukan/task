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
import { Textarea } from '@/components/ui/textarea';
import type { BoardTask, BoardColumnWithTasks } from '../types';

interface SendBackDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  task: BoardTask | null;
  sourceColumn?: BoardColumnWithTasks | null;
  targetColumn: BoardColumnWithTasks | null;
  onConfirm: (_reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function SendBackDialog({
  open,
  onOpenChange,
  task,
  targetColumn,
  onConfirm,
  isSubmitting = false,
}: SendBackDialogProps) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Reason is required.');
      return;
    }
    if (trimmed.length > 500) {
      setError('Reason must be 500 characters or fewer.');
      return;
    }

    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to send task back.');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded border border-border bg-card shadow-none">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-base font-semibold text-foreground">
              Send task back
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {task && targetColumn ? (
                <span>
                  Moving <span className="font-mono font-medium text-foreground">{task.key}</span> back to{' '}
                  <span className="font-medium text-foreground">{targetColumn.name}</span>. Provide a reason for the record.
                </span>
              ) : (
                'Give a reason for sending this task back to an earlier column.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="send-back-reason" className="text-xs font-medium text-foreground">
              Reason
            </label>
            <Textarea
              id="send-back-reason"
              placeholder="Explain why this task is being sent back..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              className="h-28 text-xs resize-none rounded-sm border-border bg-background focus:ring-ring"
              maxLength={500}
              autoFocus
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              {error ? (
                <span className="text-destructive font-medium">{error}</span>
              ) : (
                <span />
              )}
              <span className="tabular-nums">{reason.length} / 500</span>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="text-xs rounded-sm"
            >
              Cancel
            </Button>
            <Button
              id="send-back-submit-btn"
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs rounded-sm bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? 'Sending back...' : 'Send back'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
