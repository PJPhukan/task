'use client';

import * as React from 'react';
import { BoardView } from '@/features/boards/components/board-view';

interface BoardPageProps {
  params: Promise<{ projectId: string; boardId: string }>;
}

export default function BoardPage(props: BoardPageProps) {
  const { projectId, boardId } = React.use(props.params);

  return (
    <React.Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-sm" />
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-72 sm:w-80 h-96 rounded border border-border bg-card p-3 space-y-3">
                <div className="h-5 w-24 bg-muted animate-pulse rounded-sm" />
                <div className="h-24 bg-muted animate-pulse rounded-sm" />
                <div className="h-24 bg-muted animate-pulse rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <BoardView projectId={projectId} boardId={boardId} />
    </React.Suspense>
  );
}
