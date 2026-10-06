'use client';

import * as React from 'react';
import { Columns3, Plus, LayoutGrid, List } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

interface BoardDetailPageProps {
  params: Promise<{ projectId: string; boardId: string }>;
}

export default function BoardDetailPage(props: BoardDetailPageProps) {
  const { projectId, boardId } = React.use(props.params);
  const decodedProjectId = decodeURIComponent(projectId);
  const decodedBoardId = decodeURIComponent(boardId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Board: ${decodedBoardId}`}
        description={`Kanban workflow board for ${decodedProjectId}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: decodedProjectId, href: `/projects/${projectId}` },
          { label: decodedBoardId },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                className="bg-background shadow-2xs text-foreground"
                title="Board view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Add column</span>
            </Button>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>New task</span>
            </Button>
          </div>
        }
      />

      {/* Proper Empty State for the Board */}
      <EmptyState
        icon={Columns3}
        title="This board is empty"
        description="There are no workflow columns or tasks configured on this board yet. Add workflow columns (like Todo, In Progress, Done) to organize your work."
        action={{
          label: 'Add first column',
          onClick: () => {},
        }}
        className="my-8"
      />
    </div>
  );
}
