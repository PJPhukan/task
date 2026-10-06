import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface BoardSkeletonProps {
  columnCount?: number;
  className?: string;
}

export function BoardSkeleton({
  columnCount = 4,
  className,
}: BoardSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full items-start overflow-x-auto pb-4',
        className
      )}
    >
      {Array.from({ length: columnCount }).map((_, colIndex) => (
        <div
          key={colIndex}
          className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 min-w-[260px]"
        >
          {/* Column Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-5 rounded-full" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 - (colIndex % 2) }).map((_, cardIndex) => (
              <div
                key={cardIndex}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-10 rounded" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton
                  className="h-3.5 rounded"
                  style={{ width: `${70 + ((cardIndex + colIndex) % 3) * 10}%` }}
                />
                {(cardIndex + colIndex) % 2 === 0 && (
                  <Skeleton className="h-3 w-1/2 rounded" />
                )}
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
