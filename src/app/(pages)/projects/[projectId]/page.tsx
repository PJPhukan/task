'use client';

import * as React from 'react';
import { Kanban, Plus, Settings } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDetailPage(props: ProjectDetailPageProps) {
  const { projectId } = React.use(props.params);
  const decodedProjectId = decodeURIComponent(projectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Project: ${decodedProjectId}`}
        description="Overview, boards, and workflow management for this project"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: decodedProjectId },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Settings</span>
            </Button>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Create board</span>
            </Button>
          </div>
        }
      />

      {/* Proper Empty State for Boards in this project */}
      <EmptyState
        icon={Kanban}
        title="No boards in this project"
        description="Boards help you visualize workflows and track tasks across different stages. Create a Kanban board to get started."
        action={{
          label: 'Create first board',
          onClick: () => {},
        }}
        className="my-8"
      />
    </div>
  );
}
