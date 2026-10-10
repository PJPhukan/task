'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface CreateBoardDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onBoardCreated?: (_board: any) => void;
}

export function CreateBoardDialog({
  projectId,
  open,
  onOpenChange,
  onBoardCreated,
}: CreateBoardDialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<{ board: any }>(
        `/api/projects/${projectId}/boards`,
        {
          name: name.trim(),
          description: description.trim() || undefined,
        }
      );

      onOpenChange(false);
      setName('');
      setDescription('');

      if (onBoardCreated) {
        onBoardCreated(res.board);
      } else {
        router.push(`/projects/${projectId}/boards/${res.board.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create board. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create board</DialogTitle>
          <DialogDescription>
            Boards hold the workflow columns your team moves work through.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="board-name"
              className="text-xs font-medium text-foreground"
            >
              Board name
            </label>
            <Input
              id="board-name"
              placeholder="e.g. Sprint 1, Kanban"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="board-description"
              className="text-xs font-medium text-foreground"
            >
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="board-description"
              placeholder="What work does this board track?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none h-20"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Default columns (To Do, In Progress, Done) will be created automatically.
          </p>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Creating...' : 'Create board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
