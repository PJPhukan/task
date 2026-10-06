import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ListSkeletonProps {
  rowCount?: number;
  showFilters?: boolean;
  className?: string;
}

export function ListSkeleton({
  rowCount = 6,
  showFilters = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn('w-full space-y-3', className)}>
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40 overflow-hidden shadow-xs">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
          >
            {/* Status / Checkbox */}
            <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />

            {/* Task Key */}
            <Skeleton className="h-4 w-12 rounded shrink-0 hidden sm:block" />

            {/* Title */}
            <div className="flex-1 min-w-0 pr-4">
              <Skeleton
                className="h-4 rounded"
                style={{ width: `${Math.max(35, 80 - (i % 4) * 15)}%` }}
              />
            </div>

            {/* Priority dot / icon */}
            <Skeleton className="h-4 w-14 rounded-full shrink-0 hidden md:block" />

            {/* Project / Tag */}
            <Skeleton className="h-4 w-16 rounded shrink-0 hidden lg:block" />

            {/* Assignee Avatar */}
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />

            {/* Date */}
            <Skeleton className="h-3.5 w-14 rounded shrink-0 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
