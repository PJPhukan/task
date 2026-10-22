import { apiClient } from './api-client';

export interface RoleWithCount {
  id: string;
  name?: string;
  displayName: string;
  count: number;
}

/**
 * Fetches user membership count for all roles across the workspace.
 */
export async function fetchRoleUserCounts(): Promise<Record<string, number>> {
  try {
    const usersRes = await apiClient.get<{ users: Array<{ id: string }> }>('/api/users').catch(() => ({ users: [] }));
    const usersList = usersRes.users || [];
    const counts: Record<string, number> = {};

    await Promise.all(
      usersList.map(async (u) => {
        try {
          const prof = await apiClient.get<{ profile: { roles?: Array<{ id: string }> } }>(`/api/users/${u.id}/profile`);
          const userRoles = prof.profile?.roles || [];
          for (const r of userRoles) {
            counts[r.id] = (counts[r.id] || 0) + 1;
          }
        } catch {
          // Ignore individual profile failures
        }
      })
    );

    return counts;
  } catch {
    return {};
  }
}

/**
 * Sorts roles alphabetically by displayName and attaches user counts.
 */
export function formatSortedRoles<T extends { id: string; displayName: string }>(
  roles: T[],
  counts: Record<string, number> = {}
): Array<T & { count: number; labelWithCount: string; formattedName: string }> {
  return [...roles]
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((r) => {
      const count = counts[r.id] ?? 0;
      const label = `${r.displayName} (${count})`;
      return {
        ...r,
        count,
        labelWithCount: label,
        formattedName: label,
      };
    });
}
