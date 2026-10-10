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

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onProjectCreated?: (_project: any) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [key, setKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Auto-generate suggested key when name changes if key hasn't been manually edited
  const [keyManuallyEdited, setKeyManuallyEdited] = React.useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyManuallyEdited) {
      const generated = val
        .trim()
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 4)
        .toUpperCase();
      if (generated.length >= 2) {
        setKey(generated);
      }
    }
  };

  const handleKeyChange = (val: string) => {
    setKeyManuallyEdited(true);
    // Allow uppercase characters only, max 5
    const cleaned = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    setKey(cleaned);
  };

  // Validation
  const isKeyValid = /^[A-Z]{2,5}$/.test(key);
  const isNameValid = name.trim().length > 0;
  const canSubmit = isNameValid && isKeyValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<{ project: any }>('/api/projects', {
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || undefined,
      });

      onOpenChange(false);
      setName('');
      setKey('');
      setDescription('');
      setKeyManuallyEdited(false);

      if (onProjectCreated) {
        onProjectCreated(res.project);
      } else {
        router.push(`/projects/${res.project.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create project. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            A project groups boards and team members together.
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
              htmlFor="project-name"
              className="text-xs font-medium text-foreground"
            >
              Project name
            </label>
            <Input
              id="project-name"
              placeholder="e.g. Core Platform"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="project-key"
                className="text-xs font-medium text-foreground"
              >
                Project key
              </label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {key.length}/5 capital letters
              </span>
            </div>
            <Input
              id="project-key"
              placeholder="e.g. CP"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="h-9 font-mono text-xs uppercase"
              maxLength={5}
              required
            />
            <div className="flex items-center justify-between pt-0.5 text-[11px]">
              <span className="text-muted-foreground">
                Task prefix preview:{' '}
                <span className="font-mono font-medium text-foreground">
                  {key ? `${key}-101` : 'KEY-101'}
                </span>
              </span>
              {key && !isKeyValid && (
                <span className="text-destructive">2 to 5 letters required</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="project-description"
              className="text-xs font-medium text-foreground"
            >
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="project-description"
              placeholder="What does this project deliver?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none h-20"
              maxLength={1000}
            />
          </div>

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
              {isSubmitting ? 'Creating...' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
