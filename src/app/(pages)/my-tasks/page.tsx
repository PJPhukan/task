import * as React from 'react';
import { CheckCircle2, Filter, Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'My tasks | Task Manager',
  description: 'View and manage tasks assigned to you',
};

export default function MyTasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My tasks"
        description="View and track all tasks assigned to you across projects"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Filter</span>
            </Button>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>New task</span>
            </Button>
          </div>
        }
      />

      {/* View Switcher / Filter Pills */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2 text-xs">
        <button
          type="button"
          className="flex items-center gap-1.5 font-medium text-foreground px-2.5 py-1 rounded-md bg-muted/70"
        >
          <span>Assigned to me</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
            0
          </Badge>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors"
        >
          <span>Created by me</span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] h-4 border-border/60">
            0
          </Badge>
        </button>
      </div>

      {/* Empty State */}
      <EmptyState
        icon={CheckCircle2}
        title="No tasks assigned"
        description="You're all caught up! When tasks are assigned to you, they'll show up here with their status, priority, and due dates."
        action={{
          label: 'Explore projects',
          href: '/projects',
          variant: 'outline',
        }}
        className="my-8"
      />
    </div>
  );
}
