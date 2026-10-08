import * as React from 'react';
import { CheckCircle2, Filter, Plus } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: `My tasks — ${BRAND.name}`,
  description: `View and track tasks assigned to you in ${BRAND.name}`,
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
            <Button size="sm" className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90">
              <Plus className="h-3.5 w-3.5" />
              <span>New task</span>
            </Button>
          </div>
        }
      />

      {/* View Switcher / Filter Pills */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-2 text-xs">
        <button
          type="button"
          className="flex items-center gap-1.5 font-medium text-foreground px-2.5 py-1 rounded-sm bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>Assigned to me</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
            0
          </Badge>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        description="You have no tasks assigned right now."
        nextActionText="Open your projects to claim unassigned tasks or create a new task."
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
