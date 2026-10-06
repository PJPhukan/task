'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CheckSquare,
  FolderKanban,
  PanelLeftClose,
  PanelLeft,
  Layers,
  Plus,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const isMyTasksActive = pathname === '/my-tasks' || pathname === '/';
  const isProjectsActive = pathname.startsWith('/projects');

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 select-none',
        isCollapsed ? 'w-14' : 'w-60',
        className
      )}
    >
      {/* Sidebar Header: App Brand */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border/60">
        <Link
          href="/my-tasks"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 font-semibold text-foreground overflow-hidden rounded-md px-1.5 py-1 transition-colors hover:bg-sidebar-accent/50',
            isCollapsed && 'justify-center w-full px-0'
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Layers className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="text-sm font-semibold tracking-tight truncate">
              Task Manager
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
                      'flex h-9 w-9 mx-auto items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
                      'flex h-9 w-9 mx-auto items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isProjectsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/80'
              )}
            >
              <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Projects</span>
            </Link>
          )}
        </div>

        {/* Projects Section */}
        {!isCollapsed && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              <span>Projects</span>
              <Link
                href="/projects"
                onClick={onNavigate}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="View projects"
              >
                <Plus className="h-3 w-3" />
              </Link>
            </div>

            {/* Empty state for Projects */}
            <div className="px-2 py-3 rounded-md border border-dashed border-sidebar-border bg-sidebar-accent/30 text-center space-y-1.5">
              <FolderPlus className="h-4 w-4 mx-auto text-muted-foreground/60" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-sidebar-foreground/90">
                  No projects yet
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Create a project to start
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      {isCollapsed && (
        <div className="p-2 border-t border-sidebar-border/60 flex justify-center hidden md:flex">
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
