'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { TaskUser, TaskLabel } from '../types';

interface BoardFiltersProps {
  users: TaskUser[];
  labels: TaskLabel[];
  totalTasksCount: number;
  filteredTasksCount: number;
}

export function BoardFilters({
  users,
  labels,
  totalTasksCount,
  filteredTasksCount,
}: BoardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read state from URL
  const searchQuery = searchParams.get('q') || '';
  const assigneeFilter = searchParams.get('assignee') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const labelFilter = searchParams.get('label') || '';
  const overdueFilter = searchParams.get('overdue') === 'true';

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(assigneeFilter) ||
    Boolean(priorityFilter) ||
    Boolean(labelFilter) ||
    overdueFilter;

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== '' && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleClearFilters = () => {
    router.replace(pathname);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-border bg-card/50 text-xs">
      {/* Left side: Search & Dropdown filters */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {/* Search input */}
        <div className="relative w-48 sm:w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="board-search-input"
            type="search"
            placeholder="Search key or title..."
            value={searchQuery}
            onChange={(e) => updateParam('q', e.target.value)}
            className="h-8 pl-8 pr-2.5 text-xs rounded-sm border-border bg-background focus:ring-ring"
          />
        </div>

        {/* Assignee filter */}
        <select
          id="board-assignee-select"
          aria-label="Filter by assignee"
          value={assigneeFilter}
          onChange={(e) => updateParam('assignee', e.target.value)}
          className="h-8 px-2.5 rounded-sm border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring outline-none"
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          id="board-priority-select"
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) => updateParam('priority', e.target.value)}
          className="h-8 px-2.5 rounded-sm border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring outline-none"
        >
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        {/* Label filter */}
        {labels.length > 0 && (
          <select
            id="board-label-select"
            aria-label="Filter by label"
            value={labelFilter}
            onChange={(e) => updateParam('label', e.target.value)}
            className="h-8 px-2.5 rounded-sm border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring outline-none"
          >
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}

        {/* Overdue filter toggle */}
        <button
          type="button"
          onClick={() => updateParam('overdue', overdueFilter ? null : 'true')}
          className={`h-8 px-2.5 rounded-sm border inline-flex items-center gap-1.5 transition-colors font-medium ${
            overdueFilter
              ? 'bg-[hsl(var(--over-limit))]/10 border-[hsl(var(--over-limit))]/40 text-[hsl(var(--over-limit))]'
              : 'border-border text-muted-foreground hover:text-foreground bg-background'
          }`}
        >
          <AlertTriangle className="size-3" />
          <span>Overdue</span>
        </button>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3.5" />
            <span>Reset filters</span>
          </Button>
        )}
      </div>

      {/* Right side: filter count display */}
      <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
        {hasActiveFilters ? (
          <span>
            Showing <strong className="text-foreground">{filteredTasksCount}</strong> of{' '}
            {totalTasksCount} tasks
          </span>
        ) : (
          <span>
            {totalTasksCount} task{totalTasksCount === 1 ? '' : 's'} total
          </span>
        )}
      </div>
    </div>
  );
}
