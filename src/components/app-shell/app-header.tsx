'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search, User, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
}

export function AppHeader({ onOpenMobileMenu }: AppHeaderProps) {
  const pathname = usePathname();

  // Determine page title based on pathname
  const getPageTitle = () => {
    if (pathname === '/my-tasks' || pathname === '/') return 'My tasks';
    if (pathname === '/projects') return 'Projects';
    if (pathname.includes('/boards/')) {
      const parts = pathname.split('/');
      const boardId = parts[parts.indexOf('boards') + 1];
      return boardId ? `Board: ${decodeURIComponent(boardId)}` : 'Board';
    }
    if (pathname.startsWith('/projects/')) {
      const parts = pathname.split('/');
      const projectId = parts[2];
      return projectId ? `Project: ${decodeURIComponent(projectId)}` : 'Project';
    }
    return 'Task Manager';
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/95 backdrop-blur-sm px-4 sm:px-6 gap-4">
      {/* Left: Mobile Menu Trigger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenMobileMenu}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <span className="text-sm font-semibold text-foreground tracking-tight truncate hidden xs:inline-block">
          {getPageTitle()}
        </span>
      </div>

      {/* Middle: Search input (Linear style, not wired) */}
      <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search tasks, projects... (⌘K)"
            className="h-8 pl-8 pr-12 text-xs bg-muted/40 hover:bg-muted/70 focus-visible:bg-background border-border/60 transition-colors w-full rounded-md"
            readOnly
          />
          <kbd className="absolute right-2 pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Theme Toggle + User Menu Placeholder */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />

        {/* User Menu Placeholder */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full p-0 h-8 w-8 ring-1 ring-border/60 hover:ring-border"
              >
                <Avatar size="sm" className="h-7 w-7">
                  <AvatarFallback className="text-[11px] font-medium bg-primary/10 text-primary">
                    JD
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    John Doe
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    john.doe@company.internal
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-xs gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Workspace settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
