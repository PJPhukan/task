'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Kanban,
  Plus,
  Settings,
  Archive,
  Users,
  ArrowRight,
  Edit2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CreateBoardDialog } from '@/features/boards/components/create-board-dialog';
import type { Project, Board } from '@/types/project';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDetailPage(props: ProjectDetailPageProps) {
  const router = useRouter();
  const { projectId } = React.use(props.params);
  const { can } = useCurrentUser();

  const canUpdateProject = can('project.update');
  const canDeleteProject = can('project.delete');
  const canCreateBoard = can('board.create');

  const [project, setProject] = React.useState<Project | null>(null);
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Edit project state
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Archive project state
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);

  // Create board state
  const [isCreateBoardOpen, setIsCreateBoardOpen] = React.useState(false);

  const fetchProjectData = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [projRes, boardsRes] = await Promise.all([
        apiClient.get<{ project: Project }>(`/api/projects/${projectId}`),
        apiClient.get<{ boards: Board[] }>(`/api/projects/${projectId}/boards`),
      ]);

      setProject(projRes.project);
      setEditName(projRes.project.name);
      setEditDescription(projRes.project.description || '');
      setBoards(boardsRes.boards || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load project details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Handle Edit Project
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const res = await apiClient.patch<{ project: Project }>(
        `/api/projects/${projectId}`,
        {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        }
      );
      setProject(res.project);
      setIsEditDialogOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update project.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Archive Project
  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await apiClient.delete(`/api/projects/${projectId}`);
      setIsArchiveDialogOpen(false);
      router.push('/projects');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to archive project.');
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border border-border rounded-sm bg-card space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage || !project) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-destructive">{errorMessage || 'Project not found.'}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/projects')}
        >
          Back to projects
        </Button>
      </div>
    );
  }

  const isArchived = Boolean(project.archivedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.description || 'No description provided.'}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/members`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs rounded-sm"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Members</span>
              </Button>
            </Link>

            {canUpdateProject && (
              <Button
                id="edit-project-btn"
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="gap-1.5 text-xs rounded-sm"
              >
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Edit</span>
              </Button>
            )}

            {canDeleteProject && !isArchived && (
              <Button
                id="archive-project-btn"
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveDialogOpen(true)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive rounded-sm"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </Button>
            )}

            {canCreateBoard && (
              <Button
                id="create-board-btn"
                size="sm"
                onClick={() => setIsCreateBoardOpen(true)}
                className="gap-1.5 text-xs bg-brand text-brand-foreground hover:bg-brand/90 rounded-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create board</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Project Meta Details */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-sm border border-border bg-card text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Key:</span>
          <Badge variant="secondary" className="font-mono text-xs font-semibold rounded-sm">
            {project.key}
          </Badge>
        </div>

        <div className="h-3.5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Status:</span>
          {isArchived ? (
            <Badge variant="secondary" className="text-[11px] rounded-sm">
              Archived
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 rounded-sm"
            >
              Active
            </Badge>
          )}
        </div>

        <div className="h-3.5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Boards:</span>
          <span className="font-medium tabular-nums">{boards.length}</span>
        </div>
      </div>

      {/* Boards Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Boards
          </h2>
        </div>

        {boards.length === 0 ? (
          <EmptyState
            icon={Kanban}
            title="No boards yet"
            description="Add a board to start. A board holds the columns your team moves work through."
            nextActionText={
              canCreateBoard
                ? 'Create a board to configure columns and start tracking role handoffs.'
                : 'Ask a project administrator to add a board.'
            }
            action={
              canCreateBoard
                ? {
                    label: 'Create board',
                    onClick: () => setIsCreateBoardOpen(true),
                  }
                : undefined
            }
            className="my-6"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => {
              const colCount = board.columns?.length ?? 0;
              return (
                <Link
                  key={board.id}
                  href={`/projects/${projectId}/boards/${board.id}`}
                  className="group flex flex-col justify-between p-4 border border-border rounded-sm bg-card hover:border-brand/40 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                        {board.name}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    {board.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {board.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 mt-3">
                    <span className="tabular-nums">
                      {colCount} {colCount === 1 ? 'column' : 'columns'}
                    </span>
                    <span>Open board</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the project name and description.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-proj-name"
                className="text-xs font-medium text-foreground"
              >
                Project name
              </label>
              <Input
                id="edit-proj-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-proj-desc"
                className="text-xs font-medium text-foreground"
              >
                Description
              </label>
              <Textarea
                id="edit-proj-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="text-xs resize-none h-24"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={!editName.trim() || isSavingEdit}
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Project Confirmation Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Archive project</DialogTitle>
            <DialogDescription className="text-foreground pt-1">
              Archiving this project keeps existing tasks but removes it from active project lists. If the project has no tasks, it will be deleted.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsArchiveDialogOpen(false)}
              disabled={isArchiving}
            >
              Cancel
            </Button>
            <Button
              id="confirm-archive-btn"
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? 'Archiving...' : 'Archive project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Board Dialog */}
      <CreateBoardDialog
        projectId={projectId}
        open={isCreateBoardOpen}
        onOpenChange={setIsCreateBoardOpen}
        onBoardCreated={() => {
          fetchProjectData();
        }}
      />
    </div>
  );
}
