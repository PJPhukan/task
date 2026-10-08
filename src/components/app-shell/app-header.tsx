'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search, LogOut } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { useCurrentUser } from '@/hooks/use-current-user';
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
  const { user, roles, signOut } = useCurrentUser();

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
    return BRAND.name;
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials(user?.name, user?.email);
  const roleText = roles.map((r) => r.displayName).join(', ');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-background/95 backdrop-blur-xs px-4 sm:px-6 gap-4">
      {/* Left: Mobile Menu Trigger + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenMobileMenu}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="Open sidebar navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <span className="text-sm font-semibold text-foreground tracking-tight truncate hidden xs:inline-block">
          {getPageTitle()}
        </span>
      </div>

      {/* Middle: Search input */}
      <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search tasks, projects... (⌘K)"
            className="h-8 pl-8 pr-12 text-xs bg-muted/40 hover:bg-muted/70 focus-visible:bg-background border-border/70 transition-colors w-full rounded-sm"
            readOnly
          />
          <kbd className="absolute right-2 pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-background px-1 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Theme Toggle + User Menu */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full p-0 h-8 w-8 ring-1 ring-border/70 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="User account menu"
              >
                <Avatar size="sm" className="h-7 w-7">
                  <AvatarFallback className="text-[11px] font-medium bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                  {roleText && (
                    <p className="text-[10px] font-medium text-brand truncate pt-0.5">
                      {roleText}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
