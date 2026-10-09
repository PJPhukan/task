'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CheckSquare,
  FolderKanban,
  PanelLeftClose,
  PanelLeft,
  Plus,
  FolderPlus,
  UserCheck,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function AppSidebar({
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  className,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { can } = useCurrentUser();

  const isMyTasksActive = pathname === '/my-tasks' || pathname === '/';
  const isProjectsActive = pathname === '/projects' || pathname.startsWith('/projects');
  const isRolesActive = pathname.startsWith('/roles');
  const isUsersActive = pathname.startsWith('/users');
  const canCreateProject = can('project.create');

  const [sidebarProjects, setSidebarProjects] = React.useState<Array<{ id: string; name: string; key: string }>>([]);

  React.useEffect(() => {
    import('@/lib/api-client').then(({ apiClient }) => {
      apiClient
        .get<{ projects: any[] }>('/api/projects')
        .then((res) => setSidebarProjects(res.projects || []))
        .catch(() => {});
    });
  }, [pathname]);

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 select-none',
        isCollapsed ? 'w-14' : 'w-60',
        className
      )}
    >
      {/* Sidebar Header: App Brand */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border/80">
        <Link
          href="/my-tasks"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 font-semibold text-foreground overflow-hidden rounded-sm px-1.5 py-1 transition-colors hover:bg-sidebar-accent/50',
            isCollapsed && 'justify-center w-full px-0'
          )}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground font-semibold text-xs">
            R
          </div>
          {!isCollapsed && (
            <span className="text-sm font-semibold tracking-tight truncate">
              {BRAND.name}
            </span>
          )}
        </Link>

        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Core Nav */}
        <div className="space-y-1">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/my-tasks"
                    onClick={onNavigate}
                    className={cn(
                      'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isMyTasksActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    )}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span className="sr-only">My tasks</span>
                  </Link>
                }
              />
              <TooltipContent side="right">My tasks</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/my-tasks"
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isMyTasksActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/80'
              )}
            >
              <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">My tasks</span>
            </Link>
          )}

          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/projects"
                    onClick={onNavigate}
                    className={cn(
                      'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isProjectsActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    )}
                  >
                    <FolderKanban className="h-4 w-4" />
                    <span className="sr-only">Projects</span>
                  </Link>
                }
              />
              <TooltipContent side="right">Projects</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/projects"
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isProjectsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/80'
              )}
            >
              <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Projects</span>
            </Link>
          )}

          {/* Roles */}
          {can('role.manage') && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/roles"
                      onClick={onNavigate}
                      className={cn(
                        'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isRolesActive &&
                          'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      )}
                    >
                      <Shield className="h-4 w-4" />
                      <span className="sr-only">Roles</span>
                    </Link>
                  }
                />
                <TooltipContent side="right">Roles</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href="/roles"
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isRolesActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-sidebar-foreground/80'
                )}
              >
                <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">Roles</span>
              </Link>
            )
          )}

          {/* Users */}
          {(can('user.manage') || can('member.manage')) && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/users"
                      onClick={onNavigate}
                      className={cn(
                        'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isUsersActive &&
                          'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      )}
                    >
                      <Users className="h-4 w-4" />
                      <span className="sr-only">Users</span>
                    </Link>
                  }
                />
                <TooltipContent side="right">Users</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href="/users"
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isUsersActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-sidebar-foreground/80'
                )}
              >
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">Users</span>
              </Link>
            )
          )}

          {/* Invites & Join Requests */}
          {can('user.manage') && (
            <>
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href="/invites"
                        onClick={onNavigate}
                        className={cn(
                          'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          pathname === '/invites' &&
                            'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        )}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Invites</span>
                      </Link>
                    }
                  />
                  <TooltipContent side="right">Invites</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/invites"
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    pathname === '/invites'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground/80'
                  )}
                >
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">Invites</span>
                </Link>
              )}

              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href="/join-requests"
                        onClick={onNavigate}
                        className={cn(
                          'flex h-9 w-9 mx-auto items-center justify-center rounded-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          pathname === '/join-requests' &&
                            'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        )}
                      >
                        <UserCheck className="h-4 w-4" />
                        <span className="sr-only">Join requests</span>
                      </Link>
                    }
                  />
                  <TooltipContent side="right">Join requests</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/join-requests"
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    pathname === '/join-requests'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground/80'
                  )}
                >
                  <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">Join requests</span>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Projects Section */}
        {!isCollapsed && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              <span>Projects</span>
              {canCreateProject && (
                <Link
                  href="/projects/new"
                  onClick={onNavigate}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Create project"
                >
                  <Plus className="h-3 w-3" />
                </Link>
              )}
            </div>

            {sidebarProjects.length === 0 ? (
              <div className="px-2.5 py-3 rounded-sm border border-dashed border-sidebar-border bg-sidebar-accent/20 text-center space-y-1.5">
                <FolderPlus className="h-4 w-4 mx-auto text-muted-foreground/60" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-sidebar-foreground/90">
                    No projects yet
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Create your first project to start tracking role handoffs.
                  </p>
                  {canCreateProject && (
                    <div className="pt-1">
                      <Link
                        href="/projects/new"
                        onClick={onNavigate}
                        className="text-xs font-medium text-brand hover:underline inline-block"
                      >
                        + Create project
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {sidebarProjects.map((p) => {
                  const isCur = pathname.startsWith(`/projects/${p.id}`);
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isCur
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                          : 'text-sidebar-foreground/80'
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-1">
                        {p.key}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      {isCollapsed && (
        <div className="p-2 border-t border-sidebar-border/80 flex justify-center hidden md:flex">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onToggleCollapse}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      )}
    </aside>
  );
}
