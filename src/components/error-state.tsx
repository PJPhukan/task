import * as React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this view.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 sm:p-12',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3.5 ring-1 ring-destructive/20">
        <AlertCircle className="h-6 w-6" />
      </div>

      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-sm">
        {message}
      </p>

      {onRetry && (
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 border-border hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </Button>
        </div>
      )}
    </div>
  );
}
