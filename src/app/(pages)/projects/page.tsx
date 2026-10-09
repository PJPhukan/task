'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  LayoutGrid,
  Archive,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog';
import type { Project } from '@/types/project';

type FilterStatus = 'active' | 'archived' | 'all';

export default function ProjectsPage() {
  const { can } = useCurrentUser();
  const canCreateProject = can('project.create');

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [boardCounts, setBoardCounts] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>('active');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const fetchProjects = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ projects: Project[] }>('/api/projects');
      const loaded = res.projects || [];
      setProjects(loaded);

      // Fetch board counts for each project
      const counts: Record<string, number> = {};
      await Promise.all(
        loaded.map(async (p) => {
          try {
            const bRes = await apiClient.get<{ boards: any[] }>(
              `/api/projects/${p.id}/boards`
            );
            counts[p.id] = (bRes.boards || []).length;
          } catch {
            counts[p.id] = 0;
          }
        })
      );
      setBoardCounts(counts);
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filtering
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      // Status filter
      const isArchived = Boolean(p.archivedAt);
      if (filterStatus === 'active' && isArchived) return false;
      if (filterStatus === 'archived' && !isArchived) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesKey = p.key.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        return matchesName || matchesKey || matchesDesc;
      }

      return true;
    });
  }, [projects, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Organize your team's boards, workflows, and role handoffs"
        actions={
          canCreateProject ? (
            <Button
              id="create-project-btn"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create project</span>
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="projects-search-input"
            type="search"
            placeholder="Search projects by name or key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/40 border-border/70 rounded-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-sm border border-border p-0.5 bg-muted/30">
          <button
            type="button"
            id="filter-active-btn"
            onClick={() => setFilterStatus('active')}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              filterStatus === 'active'
                ? 'bg-background text-foreground font-medium shadow-none border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            id="filter-archived-btn"
            onClick={() => setFilterStatus('archived')}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              filterStatus === 'archived'
                ? 'bg-background text-foreground font-medium shadow-none border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archived
          </button>
          <button
            type="button"
            id="filter-all-btn"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              filterStatus === 'all'
                ? 'bg-background text-foreground font-medium shadow-none border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Projects List Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 border border-border rounded-sm bg-card"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects organize your boards and the roles that move work through them."
            nextActionText={
              canCreateProject
                ? 'Create your first project to configure columns and start tracking role handoffs.'
                : 'Ask a project administrator to create a project and invite you.'
            }
            action={
              canCreateProject
                ? {
                    label: 'Create project',
                    onClick: () => setIsCreateOpen(true),
                  }
                : undefined
            }
            className="my-8"
          />
        ) : filterStatus === 'archived' ? (
          <EmptyState
            icon={Archive}
            title="No archived projects"
            description="Archived projects will appear here when closed."
            nextActionText="Switch back to active projects to view current work."
            action={{
              label: 'View active projects',
              onClick: () => setFilterStatus('active'),
            }}
            className="my-8"
          />
        ) : (
          <EmptyState
            icon={Filter}
            title="No matching projects"
            description="No projects match your current search criteria."
            nextActionText="Clear the search query to see all available projects."
            action={{
              label: 'Clear search',
              onClick: () => setSearchQuery(''),
            }}
            className="my-8"
          />
        )
      ) : (
        <div className="border border-border rounded-sm overflow-hidden bg-card">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Project</div>
            <div className="col-span-2 text-center">Boards</div>
            <div className="col-span-2 text-center">Members</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-1 text-right">Open</div>
          </div>

          <div className="divide-y divide-border">
            {filteredProjects.map((project) => {
              const isArchived = Boolean(project.archivedAt);
              const boardsCount = boardCounts[project.id] ?? 0;
              const membersCount = project.members?.length ?? 1;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2 sm:gap-4 p-4 hover:bg-muted/30 transition-colors focus-visible:bg-muted/40"
                >
                  {/* Name and Key */}
                  <div className="col-span-5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors truncate">
                        {project.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[11px] font-medium px-1.5 py-0 rounded-sm"
                      >
                        {project.key}
                      </Badge>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Boards Count */}
                  <div className="col-span-2 flex sm:justify-center items-center gap-1.5 text-xs text-muted-foreground">
                    <LayoutGrid className="h-3.5 w-3.5 sm:hidden" />
                    <span className="font-medium text-foreground tabular-nums">
                      {boardsCount}
                    </span>
                    <span>{boardsCount === 1 ? 'board' : 'boards'}</span>
                  </div>

                  {/* Members Count */}
                  <div className="col-span-2 flex sm:justify-center items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5 sm:hidden" />
                    <span className="font-medium text-foreground tabular-nums">
                      {membersCount}
                    </span>
                    <span>{membersCount === 1 ? 'member' : 'members'}</span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex sm:justify-center items-center">
                    {isArchived ? (
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal text-muted-foreground bg-muted/70 rounded-sm"
                      >
                        Archived
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 rounded-sm"
                      >
                        Active
                      </Badge>
                    )}
                  </div>

                  {/* Arrow action */}
                  <div className="col-span-1 hidden sm:flex justify-end text-muted-foreground group-hover:text-foreground transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onProjectCreated={() => {
          fetchProjects();
        }}
      />
    </div>
  );
}
