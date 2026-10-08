'use client';

import * as React from 'react';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage and organize your team's projects, boards, and workflows"
        actions={
          <Button size="sm" className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90">
            <Plus className="h-3.5 w-3.5" />
            <span>Create project</span>
          </Button>
        }
      />

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search projects..."
            className="h-8 pl-8 text-xs bg-muted/40 border-border/70"
            disabled
          />
        </div>
      </div>

      {/* Empty State */}
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Projects help you organize tasks into boards and track progress across roles."
        nextActionText="Create your first project to configure columns and start tracking role handoffs."
        action={{
          label: 'Create first project',
          onClick: () => {},
        }}
        className="my-8"
      />
    </div>
  );
}
