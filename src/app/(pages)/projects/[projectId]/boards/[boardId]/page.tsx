'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Columns3,
  Plus,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ColumnSettingsDialog } from '@/features/columns/components/column-settings-dialog';
import type { Board, BoardColumn, Project } from '@/types/project';

interface BoardPageProps {
  params: Promise<{ projectId: string; boardId: string }>;
}

export default function BoardPage(props: BoardPageProps) {
  const { projectId, boardId } = React.use(props.params);
  const { can } = useCurrentUser();
  const canManageColumns = can('column.manage');

  const [project, setProject] = React.useState<Project | null>(null);
  const [board, setBoard] = React.useState<any | null>(null);
  const [columnRules, setColumnRules] = React.useState<Record<string, { moveRoles?: any[] }>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = React.useState(false);

  const fetchBoard = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [projRes, boardRes] = await Promise.all([
        apiClient.get<{ project: Project }>(`/api/projects/${projectId}`),
        apiClient.get<{ board: any }>(`/api/projects/${projectId}/boards/${boardId}`),
      ]);

      setProject(projRes.project);
      setBoard(boardRes.board);

      // Fetch rules for each column
      const rules: Record<string, { moveRoles?: any[] }> = {};
      const cols = boardRes.board?.columns || [];
      await Promise.all(
        cols.map(async (c: any) => {
          try {
            const r = await apiClient.get<any>(
              `/api/projects/${projectId}/columns/${c.id}/rules`
            );
            rules[c.id] = r;
          } catch {
            rules[c.id] = {};
          }
        })
      );
      setColumnRules(rules);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to load board.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, boardId]);

  React.useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const formatWaiting = (seconds: number) => {
    if (seconds <= 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-72 shrink-0 border border-border rounded-sm bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage || !board) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-destructive">{errorMessage || 'Board not found.'}</p>
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline" size="sm">Back to project</Button>
        </Link>
      </div>
    );
  }

  const columns: any[] = board.columns || [];

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6.5rem)]">
      <PageHeader
        title={board.name}
        description={`Workflow board for ${project?.name || 'Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name || 'Project', href: `/projects/${projectId}` },
          { label: board.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canManageColumns && (
              <Button
                id="column-settings-btn"
                variant="outline"
                size="sm"
                onClick={() => setIsColumnSettingsOpen(true)}
                className="gap-1.5 text-xs rounded-sm"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Column settings</span>
              </Button>
            )}
          </div>
        }
      />

      {columns.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="This board has no columns"
          description="Add columns to start moving tasks through stages."
          nextActionText={
            canManageColumns
              ? 'Open column settings to add workflow columns.'
              : 'Ask a project administrator to configure columns.'
          }
          action={
            canManageColumns
              ? {
                  label: 'Configure columns',
                  onClick: () => setIsColumnSettingsOpen(true),
                }
              : undefined
          }
          className="my-auto"
        />
      ) : (
        <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-4 items-start select-none">
          {columns.map((column) => {
            const moveRoles = columnRules[column.id]?.moveRoles || [];
            const ownerNames = moveRoles.map((r: any) => r.displayName || r.id).join(', ');
            const tasks: any[] = column.tasks || [];

            return (
              <div
                key={column.id}
                className="w-72 sm:w-80 shrink-0 flex flex-col max-h-full rounded-sm border border-border bg-card/60 backdrop-blur-xs overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-border bg-muted/30 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {column.color && (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: column.color }}
                        />
                      )}
                      <span className="text-xs font-semibold text-foreground tracking-tight truncate">
                        {column.name}
                      </span>
                    </div>

                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {tasks.length}
                    </span>
                  </div>

                  {/* Role Ownership & Time limit line */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span className="truncate">
                      {ownerNames ? (
                        <span className="font-medium text-foreground">
                          [{ownerNames}]
                        </span>
                      ) : (
                        <span>Anyone</span>
                      )}
                    </span>

                    {column.isDone ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Done</span>
                    ) : column.timeLimitHours ? (
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        <span>{column.timeLimitHours}h limit</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-muted-foreground/70">
                      No tasks in this column
                    </div>
                  ) : (
                    tasks.map((task: any) => {
                      const isOver = task.overLimit;
                      return (
                        <div
                          key={task.id}
                          className="p-3 rounded-sm border border-border bg-card hover:border-brand/40 transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-medium text-foreground/80">
                              {task.key}
                            </span>
                            <span
                              className={`tabular-nums font-medium ${
                                isOver
                                  ? 'text-destructive font-semibold'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {isOver && '! '}
                              {formatWaiting(task.waitingSeconds)}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                            {task.title}
                          </p>

                          {task.bounceCount > 0 && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                              Sent back {task.bounceCount} time{task.bounceCount === 1 ? '' : 's'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Column settings dialog */}
      <ColumnSettingsDialog
        projectId={projectId}
        boardId={boardId}
        open={isColumnSettingsOpen}
        onOpenChange={setIsColumnSettingsOpen}
        onColumnsUpdated={fetchBoard}
      />
    </div>
  );
}
